import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { MetaCloudClient } from '@bms/whatsapp-cloud';
import { EvolutionHubClient, buildHubSignupUrl } from '@bms/evolution-hub';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { CreateWhatsappChannelDto, createChannelSchema } from './dtos/create-channel.dto';
import { WhatsappModeResolverService } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.service';

// Restricted set of events the Hub should forward to the BMS. Less noise on
// /webhooks/evolution-hub and a smaller blast radius if the Hub adds new
// event families later. Aligned with the WhatsApp event types in the Hub
// (pkg/webhook/model/event_types.go).
const HUB_WHATSAPP_EVENTS = ['messages', 'message_template_status_update', 'message_template_quality_update', 'message_template_components_update', 'account_update'];

export interface ChannelSummary {
  id: number;
  name: string;
  mode: 'meta' | 'evohub';
  status: 'pending' | 'active' | 'disconnected' | 'error';
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  wabaId: string | null;
  /** Only present on EvoHub channels right after create — frontend opens it in a new tab. */
  publicLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wave 4 — per-account CRUD of WhatsApp channels.
 *
 * Both modes (Meta direct, EvoHub) write to the same `whatsapp_channels` table.
 * The mode discriminator drives which provider is called at create time, but
 * after that the row shape is identical and the sender (wave 5) can resolve
 * either via WhatsappModeResolverService without branching.
 */
@Injectable()
export class WhatsappChannelsService {
  private readonly logger = new Logger(WhatsappChannelsService.name);

  constructor(
    @InjectRepository(WhatsappChannelEntity) private readonly repo: Repository<WhatsappChannelEntity>,
    private readonly cls: ClsService,
    private readonly resolver: WhatsappModeResolverService,
  ) {}

  async list(accountId: number): Promise<ChannelSummary[]> {
    this.assertSameAccount(accountId);
    const rows = await this.repo.find({ where: { accountId }, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toSummary(r));
  }

  async get(accountId: number, channelId: number): Promise<ChannelSummary> {
    this.assertSameAccount(accountId);
    const row = await this.repo.findOne({ where: { id: channelId, accountId } });
    if (!row) throw new NotFoundException(`WhatsApp channel ${channelId} not found`);
    return this.toSummary(row);
  }

  async create(accountId: number, payload: CreateWhatsappChannelDto): Promise<ChannelSummary> {
    this.assertSameAccount(accountId);

    const { value, error } = createChannelSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));
    const dto = value as CreateWhatsappChannelDto;

    if (dto.mode === 'meta') {
      return this.createMeta(accountId, dto);
    }
    return this.createEvoHub(accountId, dto);
  }

  async delete(accountId: number, channelId: number): Promise<void> {
    this.assertSameAccount(accountId);
    const row = await this.repo.findOne({ where: { id: channelId, accountId } });
    if (!row) throw new NotFoundException(`WhatsApp channel ${channelId} not found`);

    // EvoHub cleanup: best-effort. If the Hub call fails we still drop the
    // local row — the user is explicit about removing the channel, and the
    // alternative (orphan local row pointing at a dead Hub channel) is worse.
    if (row.mode === 'evohub' && row.hubChannelId) {
      const hub = this.buildHubClient();
      if (hub) {
        try {
          await hub.deleteChannel(row.hubChannelId);
        } catch (err: any) {
          this.logger.warn(`evohub_delete_channel_failed id=${row.hubChannelId} err=${err?.message ?? 'unknown'}`);
        }
        // The Hub's DELETE /channels/:id only cascades the channel_webhooks
        // join table — the webhook resource itself stays orphaned. We saved
        // the webhook_id in evolution_hub_meta at create time; delete it
        // explicitly here so we do not leave junk webhooks on the Hub.
        const webhookId = (row.evolutionHubMeta as { webhook_id?: string } | null)?.webhook_id;
        if (webhookId) {
          try {
            await hub.deleteWebhook(webhookId);
          } catch (err: any) {
            this.logger.warn(`evohub_delete_webhook_failed id=${webhookId} err=${err?.message ?? 'unknown'}`);
          }
        }
      }
    }

    await this.repo.delete({ id: channelId });
  }

  private async createMeta(accountId: number, dto: CreateWhatsappChannelDto): Promise<ChannelSummary> {
    if (await this.resolver.isHubEnabled()) {
      throw new HttpException("Install is in EvoHub mode — use mode='evohub' to create channels.", HttpStatus.BAD_REQUEST);
    }
    if (!process.env.WHATSAPP_APP_ID || !process.env.WHATSAPP_APP_SECRET) {
      throw new HttpException('Meta App credentials are not configured. Set them in Super Admin → WhatsApp (Meta App).', HttpStatus.PRECONDITION_FAILED);
    }

    const client = new MetaCloudClient({ graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v18.0' });
    let accessToken: string;
    try {
      const result = await client.exchangeCodeForToken({
        appId: process.env.WHATSAPP_APP_ID,
        appSecret: process.env.WHATSAPP_APP_SECRET,
        code: dto.code!,
      });
      accessToken = result.accessToken;
    } catch (err: any) {
      this.logger.error(`meta_code_exchange_failed account=${accountId} err=${err?.message ?? 'unknown'}`);
      throw new HttpException('Failed to exchange Meta code for access_token. Check the Meta App credentials and the code returned by FB.login.', HttpStatus.BAD_GATEWAY);
    }

    const entity = this.repo.create({
      accountId,
      name: dto.name,
      mode: 'meta',
      status: 'active',
      phoneNumberId: dto.phone_number_id!,
      wabaId: dto.waba_id!,
      businessId: dto.business_id ?? null,
      accessToken,
    });
    const saved = await this.repo.save(entity);
    return this.toSummary(saved);
  }

  /**
   * Lists every WhatsApp channel that exists on the Hub for the configured
   * API key — used by the "Conectar canal existente" picker on the frontend.
   * Returns the raw Hub shape so the operator can pick by WABA name / phone.
   */
  async listHubChannels(accountId: number): Promise<
    Array<{
      id: string;
      name?: string;
      status: string;
      wabaName?: string;
      displayPhoneNumber?: string;
      phoneNumberId?: string;
      wabaId?: string;
      alreadyAttached: boolean;
    }>
  > {
    this.assertSameAccount(accountId);
    if (!(await this.resolver.isHubEnabled())) {
      throw new HttpException('Install is in Meta direct mode — EvoHub is disabled.', HttpStatus.BAD_REQUEST);
    }
    const hub = this.buildHubClient();
    if (!hub) {
      throw new HttpException('EvoHub API key is not configured. Set it in Super Admin → WhatsApp (EvoHub).', HttpStatus.PRECONDITION_FAILED);
    }

    const remote = await hub.listChannels();
    // Mark channels we already track locally so the frontend can disable them
    // in the picker (cannot attach twice).
    const localHubIds = new Set(
      (
        await this.repo.find({
          where: { accountId, mode: 'evohub' },
          select: ['hubChannelId'],
        })
      )
        .map((r) => r.hubChannelId)
        .filter(Boolean) as string[],
    );

    return remote
      .filter((c) => (c.type ?? 'whatsapp') === 'whatsapp')
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        wabaName: c.meta_connection?.waba_name,
        displayPhoneNumber: c.meta_connection?.phone_numbers?.[0]?.display_phone_number,
        phoneNumberId: c.meta_connection?.phone_number_id,
        wabaId: c.meta_connection?.waba_id,
        alreadyAttached: localHubIds.has(c.id),
      }));
  }

  /**
   * Wires the BMS up to a WhatsApp channel that already exists on the Hub
   * (created by another system, e.g. evo-ai CRM). No Embedded Signup: we
   * just create a webhook on the Hub that points back to the BMS and
   * persist a local row pre-populated with the channel's meta_connection.
   *
   * Same single-channel-per-account rule as createEvoHub — selecting an
   * existing channel still consumes the slot.
   */
  async attachToExistingHubChannel(accountId: number, input: { hubChannelId: string; name?: string }): Promise<ChannelSummary> {
    this.assertSameAccount(accountId);
    if (!(await this.resolver.isHubEnabled())) {
      throw new HttpException("Install is in Meta direct mode — use mode='meta' to create channels.", HttpStatus.BAD_REQUEST);
    }
    if (!input.hubChannelId) {
      throw new BadRequestException('hubChannelId is required');
    }

    const existing = await this.repo.findOne({
      where: [
        { accountId, mode: 'evohub', status: 'active' },
        { accountId, mode: 'evohub', status: 'pending' },
      ],
    });
    if (existing) {
      throw new HttpException('This account already has an EvoHub channel. Disconnect it before attaching to another one.', HttpStatus.CONFLICT);
    }

    const webhookSecret = process.env.EVOLUTION_HUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new HttpException('EvoHub webhook secret is not configured. Set it in Super Admin → WhatsApp (EvoHub).', HttpStatus.PRECONDITION_FAILED);
    }
    const publicUrl = (process.env.BMS_PUBLIC_URL ?? '').replace(/\/+$/, '');
    if (!publicUrl) {
      throw new HttpException('BMS_PUBLIC_URL env is not set. Configure the public URL so the Hub can deliver webhooks back to BMS.', HttpStatus.PRECONDITION_FAILED);
    }

    const hub = this.buildHubClient();
    if (!hub) {
      throw new HttpException('EvoHub API key is not configured. Set it in Super Admin → WhatsApp (EvoHub).', HttpStatus.PRECONDITION_FAILED);
    }

    // Pull the channel meta first so we can hydrate the local row with
    // waba_id/phone_number_id straight away (channel is already connected,
    // no need to wait for a channel_connected webhook).
    let hubChannel: Awaited<ReturnType<EvolutionHubClient['getChannel']>>;
    try {
      hubChannel = await hub.getChannel(input.hubChannelId);
    } catch (err: any) {
      this.logger.error(`evohub_get_channel_failed id=${input.hubChannelId} err=${err?.message ?? 'unknown'}`);
      throw new HttpException(`EvoHub channel ${input.hubChannelId} not found or not accessible with the current API key.`, HttpStatus.NOT_FOUND);
    }
    const conn = hubChannel.meta_connection ?? {};
    const phoneNumberId = conn.phone_number_id ?? conn.phone_numbers?.[0]?.id ?? null;
    const wabaId = conn.waba_id ?? null;
    const displayPhone = conn.phone_numbers?.find((p) => p.id === phoneNumberId)?.display_phone_number ?? conn.phone_numbers?.[0]?.display_phone_number ?? null;

    let webhook: { id: string };
    try {
      webhook = await hub.createWebhook({
        name: `BMS account ${accountId}`,
        url: `${publicUrl}/webhooks/evolution-hub`,
        events: HUB_WHATSAPP_EVENTS,
        secret: webhookSecret,
        channels: [input.hubChannelId],
      });
    } catch (err: any) {
      this.logger.error(`evohub_create_webhook_failed account=${accountId} channel=${input.hubChannelId} err=${err?.message ?? 'unknown'}`);
      throw new HttpException('Failed to create the BMS webhook on EvoHub for the selected channel.', HttpStatus.BAD_GATEWAY);
    }

    const status: 'active' | 'pending' = phoneNumberId && wabaId ? 'active' : 'pending';
    const entity = this.repo.create({
      accountId,
      name: input.name ?? hubChannel.name ?? `EvoHub channel ${input.hubChannelId.slice(0, 8)}`,
      mode: 'evohub',
      status,
      hubChannelId: input.hubChannelId,
      channelToken: hubChannel.token ?? null,
      phoneNumberId,
      wabaId,
      displayPhoneNumber: displayPhone,
      evolutionHubMeta: {
        created_at: new Date().toISOString(),
        source: 'admin_ui_attach_existing',
        webhook_id: webhook.id,
        webhook_events: HUB_WHATSAPP_EVENTS,
      },
    });
    const saved = await this.repo.save(entity);
    return this.toSummary(saved);
  }

  private async createEvoHub(accountId: number, dto: CreateWhatsappChannelDto): Promise<ChannelSummary> {
    if (!(await this.resolver.isHubEnabled())) {
      throw new HttpException("Install is in Meta direct mode — use mode='meta' to create channels.", HttpStatus.BAD_REQUEST);
    }

    // EvoHub: one channel per account. If the account already has a channel
    // that is alive (active or still pending signup), refuse the create and
    // let the user reconnect by deleting the existing one first.
    const existing = await this.repo.findOne({
      where: [
        { accountId, mode: 'evohub', status: 'active' },
        { accountId, mode: 'evohub', status: 'pending' },
      ],
    });
    if (existing) {
      throw new HttpException('This account already has an EvoHub channel. Disconnect it before creating a new one.', HttpStatus.CONFLICT);
    }

    const webhookSecret = process.env.EVOLUTION_HUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new HttpException('EvoHub webhook secret is not configured. Set it in Super Admin → WhatsApp (EvoHub).', HttpStatus.PRECONDITION_FAILED);
    }
    const publicUrl = (process.env.BMS_PUBLIC_URL ?? '').replace(/\/+$/, '');
    if (!publicUrl) {
      throw new HttpException('BMS_PUBLIC_URL env is not set. Configure the public URL so the Hub can deliver webhooks back to BMS.', HttpStatus.PRECONDITION_FAILED);
    }

    const hub = this.buildHubClient();
    if (!hub) {
      throw new HttpException('EvoHub API key is not configured. Set it in Super Admin → WhatsApp (EvoHub).', HttpStatus.PRECONDITION_FAILED);
    }

    let hubResult: Awaited<ReturnType<EvolutionHubClient['createChannel']>>;
    try {
      hubResult = await hub.createChannel({
        name: dto.name,
        type: 'whatsapp',
        external_id: String(accountId),
        // Single-shot: Hub creates the channel AND a webhook bound to it,
        // scoped to WhatsApp events only. No need for a separate POST to
        // /webhooks/:id/associate later.
        webhook_url: `${publicUrl}/webhooks/evolution-hub`,
        webhook_secret: webhookSecret,
        webhook_events: HUB_WHATSAPP_EVENTS,
      });
    } catch (err: any) {
      this.logger.error(`evohub_create_channel_failed account=${accountId} err=${err?.message ?? 'unknown'}`);
      throw new HttpException('Failed to create channel on EvoHub. Check Hub API key.', HttpStatus.BAD_GATEWAY);
    }

    const entity = this.repo.create({
      accountId,
      name: dto.name,
      mode: 'evohub',
      status: 'pending',
      hubChannelId: hubResult.channel.id,
      channelToken: hubResult.channel.token,
      evolutionHubMeta: {
        created_at: new Date().toISOString(),
        source: 'admin_ui',
        webhook_id: hubResult.webhook_id,
        webhook_events: HUB_WHATSAPP_EVENTS,
      },
    });
    const saved = await this.repo.save(entity);
    const summary = this.toSummary(saved);
    summary.publicLink = buildHubSignupUrl(hubResult.channel.token);
    return summary;
  }

  private buildHubClient(): EvolutionHubClient | null {
    const apiKey = process.env.EVOLUTION_HUB_API_KEY;
    if (!apiKey) return null;
    const baseUrl = process.env.EVOLUTION_HUB_URL ?? 'https://api.evohub.ai';
    return new EvolutionHubClient({ apiKey, baseUrl });
  }

  private assertSameAccount(accountId: number): void {
    const scoped = this.cls.get('accountId');
    if (scoped && Number(scoped) !== accountId) {
      throw new HttpException('Account mismatch', HttpStatus.FORBIDDEN);
    }
  }

  private toSummary(row: WhatsappChannelEntity): ChannelSummary {
    return {
      id: row.id,
      name: row.name,
      mode: row.mode,
      status: row.status,
      phoneNumberId: row.phoneNumberId,
      displayPhoneNumber: row.displayPhoneNumber,
      wabaId: row.wabaId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
