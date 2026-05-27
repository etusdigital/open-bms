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
      try {
        const hub = this.buildHubClient();
        if (hub) await hub.deleteChannel(row.hubChannelId);
      } catch (err: any) {
        this.logger.warn(`evohub_delete_channel_failed id=${row.hubChannelId} err=${err?.message ?? 'unknown'}`);
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

  private async createEvoHub(accountId: number, dto: CreateWhatsappChannelDto): Promise<ChannelSummary> {
    if (!(await this.resolver.isHubEnabled())) {
      throw new HttpException("Install is in Meta direct mode — use mode='meta' to create channels.", HttpStatus.BAD_REQUEST);
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
