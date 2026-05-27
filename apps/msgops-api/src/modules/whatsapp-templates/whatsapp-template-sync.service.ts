import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { WhatsappModeResolverService } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.service';
import { MessageDto } from '../messages/messages.dto';

const CATEGORY_AUTH = 'AUTHENTICATION';
const CATEGORY_MARKETING = 'MARKETING';

export interface TemplateSyncResult {
  /** Template name accepted by Meta (snake_case, used as providerMessageId). */
  name: string;
  /** Meta template id when returned in the create response. */
  metaTemplateId?: string;
  /** Lifecycle status returned by Meta on submit. Always 'PENDING' until the review is complete. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
}

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO';
  text?: string;
  url?: string;
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
  buttons?: unknown[];
  example?: Record<string, unknown>;
}

interface MetaCreateTemplatePayload {
  name: string;
  category: typeof CATEGORY_AUTH | typeof CATEGORY_MARKETING;
  allow_category_change: boolean;
  language: string;
  components: MetaTemplateComponent[];
}

/**
 * Wave 6 — submits a WhatsApp template to Meta's WABA review queue.
 *
 * Replaces the Evolution-API-based `approveEvolution` removed in wave 2.
 * Builds the Cloud-API payload from the `messages` row the wave 7 UI
 * already produces (headerType/headerContent/body/footer + whatsappType +
 * callToAction*), resolves the right channel for the account, calls
 * `POST {baseUrl}/{waba_id}/message_templates` with the channel's
 * bearerToken (`access_token` in meta mode, `channel_token` in EvoHub).
 *
 * Result is the template `name` Meta accepted — we persist it as the
 * Message.providerMessageId so wave 5's send path can reference it.
 */
@Injectable()
export class WhatsappTemplateSyncService {
  private readonly logger = new Logger(WhatsappTemplateSyncService.name);

  constructor(
    @InjectRepository(WhatsappChannelEntity) private readonly channels: Repository<WhatsappChannelEntity>,
    @InjectRepository(AccountConfigEntity) private readonly accountConfigs: Repository<AccountConfigEntity>,
    private readonly resolver: WhatsappModeResolverService,
  ) {}

  async syncMessageToMeta(messageDto: MessageDto, templateName: string): Promise<TemplateSyncResult> {
    const accountId = messageDto.accountId ?? messageDto.account?.id;
    if (!accountId) throw new BadRequestException('Cannot sync template: missing account.id on the message');

    const channel = await this.channels.findOne({
      where: { accountId: Number(accountId), status: 'active' },
      order: { lastEventAt: 'DESC', updatedAt: 'DESC' },
    });
    if (!channel) {
      throw new HttpException(`No active WhatsApp channel for account ${accountId}. Connect one in Settings → WhatsApp before syncing templates.`, HttpStatus.PRECONDITION_FAILED);
    }
    if (!channel.wabaId) {
      throw new HttpException(`WhatsApp channel ${channel.id} is missing waba_id — reconnect.`, HttpStatus.PRECONDITION_FAILED);
    }
    if (channel.mode === 'meta' && !channel.accessToken) {
      throw new HttpException(`WhatsApp channel ${channel.id} is missing access_token — reconnect.`, HttpStatus.PRECONDITION_FAILED);
    }
    if (channel.mode === 'evohub' && !channel.channelToken) {
      throw new HttpException(`WhatsApp channel ${channel.id} is missing channel_token — reconnect.`, HttpStatus.PRECONDITION_FAILED);
    }

    const resolved = await this.resolver.resolveChannel({
      mode: channel.mode,
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      channelToken: channel.channelToken,
    });
    const language = (await this.readAccountConfig(Number(accountId), 'default_language')) ?? 'pt_BR';
    const shortlinkBaseUrl = await this.readAccountConfig(Number(accountId), 'shortlink_base_url');

    const payload = this.buildPayload({
      name: this.sanitiseName(templateName),
      messageDto,
      language,
      shortlinkBaseUrl,
    });

    let response;
    try {
      response = await axios.post(`${resolved.baseUrl}/${channel.wabaId}/message_templates`, payload, {
        headers: { Authorization: `Bearer ${resolved.bearerToken}`, 'Content-Type': 'application/json' },
        timeout: 15_000,
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const body = axios.isAxiosError(err) ? err.response?.data : undefined;
      this.logger.error(`wa_template_sync_failed account=${accountId} status=${status ?? '?'} body=${this.safe(body)}`);
      throw new HttpException(this.metaErrorMessage(body) ?? 'Meta refused the template submit.', status === 400 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY);
    }

    const data = response.data ?? {};
    return {
      name: payload.name,
      metaTemplateId: data.id,
      status: data.status ?? 'PENDING',
    };
  }

  /**
   * Builds the Meta Cloud API `POST /message_templates` payload from the
   * messages row.
   *
   * `messageDto.content` carries the rich-text JSON the UI produces (see
   * apps/frontend-react/src/features/messages/components/whatsapp-content-form.tsx).
   * Shape: { headerType, headerContent, body, footer }.
   */
  buildPayload(opts: { name: string; messageDto: MessageDto; language: string; shortlinkBaseUrl: string | null }): MetaCreateTemplatePayload {
    const { name, messageDto, language, shortlinkBaseUrl } = opts;
    const is2fa = messageDto.type === '2FA-whatsapp';
    const content = this.parseContent(messageDto.content);

    if (is2fa) {
      return {
        name,
        category: CATEGORY_AUTH,
        allow_category_change: false,
        language,
        components: [
          { type: 'BODY', add_security_recommendation: true },
          { type: 'FOOTER', code_expiration_minutes: 10 },
          { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] },
        ],
      };
    }

    const components: MetaTemplateComponent[] = [];

    if (content.headerType === 'text' && content.headerContent) {
      components.push({ type: 'HEADER', format: 'TEXT', text: content.headerContent });
    } else if (content.headerType === 'image' && content.headerContent) {
      components.push({ type: 'HEADER', format: 'IMAGE', url: content.headerContent });
    } else if (content.headerType === 'video' && content.headerContent) {
      components.push({ type: 'HEADER', format: 'VIDEO', url: content.headerContent });
    }

    components.push({ type: 'BODY', text: content.body ?? '' });

    if (content.footer) {
      components.push({ type: 'FOOTER', text: content.footer });
    }

    if (messageDto.whatsappType === 'call-to-action' && messageDto.callToActionText) {
      const baseUrl = shortlinkBaseUrl ?? 'https://example.com/';
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: messageDto.callToActionText,
            url: `${baseUrl}{{1}}`,
            example: { url: baseUrl },
          },
        ],
      });
    }

    return {
      name,
      category: CATEGORY_MARKETING,
      allow_category_change: false,
      language,
      components,
    };
  }

  /** Meta requires names matching `^[a-z][a-z0-9_]*$` and max 512 chars. */
  sanitiseName(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+/, '')
      .slice(0, 512);
  }

  private parseContent(raw?: string | null): { headerType?: string; headerContent?: string; body?: string; footer?: string } {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      // Legacy / unstructured content — treat the whole thing as the body.
      return { body: raw };
    }
  }

  private async readAccountConfig(accountId: number, name: string): Promise<string | null> {
    const row = await this.accountConfigs.findOne({ where: { accountId, name } });
    return row?.value ?? null;
  }

  private metaErrorMessage(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const err = (body as { error?: { message?: string; error_user_msg?: string } }).error;
    return err?.error_user_msg ?? err?.message ?? null;
  }

  private safe(value: unknown): string {
    try {
      return JSON.stringify(value).slice(0, 500);
    } catch {
      return '[unstringifiable]';
    }
  }
}
