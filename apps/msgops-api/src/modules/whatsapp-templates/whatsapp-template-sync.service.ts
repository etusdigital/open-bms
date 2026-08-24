import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { WhatsappModeResolverService } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.service';
import { MessageDto } from '../messages/messages.dto';
import { toMetaBody } from './template-variables';

const CATEGORY_AUTH = 'AUTHENTICATION';
const CATEGORY_MARKETING = 'MARKETING';
const CATEGORY_UTILITY = 'UTILITY';
const VALID_CATEGORIES = new Set([CATEGORY_MARKETING, CATEGORY_UTILITY]);

export interface TemplateSyncResult {
  /** Template name accepted by Meta (snake_case, used as providerMessageId). */
  name: string;
  /** Meta template id when returned in the create response. */
  metaTemplateId?: string;
  /** Lifecycle status returned by Meta on submit. Always 'PENDING' until the review is complete. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
}

export interface TemplateStatusFetchResult {
  name: string;
  /** Raw verdict returned by Meta — APPROVED / REJECTED / PENDING / PAUSED / DISABLED. */
  metaStatus: string;
  /** BMS-side Message.status — see normaliseStatus(). */
  status: 'approved' | 'rejected' | 'sent_approval';
  metaTemplateId?: string;
  rejectedReason?: string;
}

export interface MetaTemplateListItem {
  id?: string;
  name: string;
  status: string;
  language?: string;
  category?: string;
  rejected_reason?: string;
  components?: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO';
    text?: string;
    buttons?: Array<{ type?: string; text?: string; url?: string }>;
  }>;
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
  category: typeof CATEGORY_AUTH | typeof CATEGORY_MARKETING | typeof CATEGORY_UTILITY;
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
   * On-demand poll of Meta to learn the current verdict of a template.
   *
   * Same channel-resolution path as syncMessageToMeta, then a GET to
   * `/{waba_id}/message_templates?name=...` which returns
   * `{ data: [{ id, status, language, rejected_reason? }] }`.
   *
   * The webhook handler (Onda 4) does the same job reactively when Meta
   * pings us — this method gives the operator a button to force the
   * resolution without waiting for the webhook (and survives a missed
   * webhook delivery).
   */
  async fetchTemplateStatus(accountId: number, templateName: string): Promise<TemplateStatusFetchResult> {
    if (!accountId) throw new BadRequestException('Cannot sync template status: missing account id');
    if (!templateName) throw new BadRequestException('Cannot sync template status: missing template name');

    const channel = await this.channels.findOne({
      where: { accountId, status: 'active' },
      order: { lastEventAt: 'DESC', updatedAt: 'DESC' },
    });
    if (!channel) {
      throw new HttpException(`No active WhatsApp channel for account ${accountId}.`, HttpStatus.PRECONDITION_FAILED);
    }
    if (!channel.wabaId) {
      throw new HttpException(`WhatsApp channel ${channel.id} is missing waba_id — reconnect.`, HttpStatus.PRECONDITION_FAILED);
    }

    const resolved = await this.resolver.resolveChannel({
      mode: channel.mode,
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      channelToken: channel.channelToken,
    });

    let response;
    try {
      response = await axios.get(`${resolved.baseUrl}/${channel.wabaId}/message_templates`, {
        params: { name: templateName, fields: 'name,status,id,rejected_reason,language,category' },
        headers: { Authorization: `Bearer ${resolved.bearerToken}` },
        timeout: 15_000,
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const body = axios.isAxiosError(err) ? err.response?.data : undefined;
      this.logger.error(`wa_template_status_fetch_failed account=${accountId} name=${templateName} status=${status ?? '?'} body=${this.safe(body)}`);
      throw new HttpException(this.metaErrorMessage(body) ?? 'Meta refused the template status query.', status === 400 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY);
    }

    const rows: Array<{ id?: string; name?: string; status?: string; rejected_reason?: string }> = response.data?.data ?? [];
    const match = rows.find((r) => r.name === templateName) ?? rows[0];
    if (!match) {
      throw new HttpException(`Template "${templateName}" not found on Meta (waba_id=${channel.wabaId}).`, HttpStatus.NOT_FOUND);
    }
    const metaStatus = (match.status ?? 'PENDING').toUpperCase();
    return {
      name: match.name ?? templateName,
      metaStatus,
      status: this.normaliseStatus(metaStatus),
      metaTemplateId: match.id,
      rejectedReason: match.rejected_reason,
    };
  }

  /**
   * Lists every template that exists on Meta for the account's active WABA.
   *
   * Used by the "Sincronizar templates" button on the messages list so the
   * operator can pull templates created directly on Business Manager into
   * BMS (e.g. legacy templates, templates created by another team).
   *
   * Paginates via Meta's cursor (`paging.next`) — caps at 500 templates
   * to avoid runaway calls; raise if it ever bites.
   */
  async listMetaTemplates(accountId: number): Promise<MetaTemplateListItem[]> {
    if (!accountId) throw new BadRequestException('Cannot list templates: missing account id');

    const channel = await this.channels.findOne({
      where: { accountId, status: 'active' },
      order: { lastEventAt: 'DESC', updatedAt: 'DESC' },
    });
    if (!channel) {
      throw new HttpException(`No active WhatsApp channel for account ${accountId}.`, HttpStatus.PRECONDITION_FAILED);
    }
    if (!channel.wabaId) {
      throw new HttpException(`WhatsApp channel ${channel.id} is missing waba_id — reconnect.`, HttpStatus.PRECONDITION_FAILED);
    }

    const resolved = await this.resolver.resolveChannel({
      mode: channel.mode,
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      channelToken: channel.channelToken,
    });

    const collected: MetaTemplateListItem[] = [];
    let nextUrl: string | null = `${resolved.baseUrl}/${channel.wabaId}/message_templates`;
    let params: Record<string, string> | undefined = {
      fields: 'name,status,id,rejected_reason,language,category,components',
      limit: '100',
    };
    const HARD_CAP = 500;

    while (nextUrl && collected.length < HARD_CAP) {
      let response;
      try {
        response = await axios.get(nextUrl, {
          params,
          headers: { Authorization: `Bearer ${resolved.bearerToken}` },
          timeout: 15_000,
        });
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        const body = axios.isAxiosError(err) ? err.response?.data : undefined;
        this.logger.error(`wa_template_list_failed account=${accountId} status=${status ?? '?'} body=${this.safe(body)}`);
        throw new HttpException(this.metaErrorMessage(body) ?? 'Meta refused the template list query.', status === 400 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY);
      }
      const rows: MetaTemplateListItem[] = response.data?.data ?? [];
      collected.push(...rows);
      // `paging.next` is a fully-qualified URL with the cursor embedded —
      // pass it through without re-injecting our params.
      nextUrl = response.data?.paging?.next ?? null;
      params = undefined;
    }
    return collected;
  }

  /**
   * Deletes a template on Meta. Graph API:
   *   DELETE /{waba_id}/message_templates?name={template_name}
   * Meta tombstones the entry (status PENDING_DELETION → eventually removed).
   *
   * Safe to call when:
   *   - the template was never synced (no `providerMessageId` upstream) — caller
   *     should short-circuit before invoking this method.
   *   - Meta returns 404 ("template not found"): treat as already-deleted, swallow.
   *
   * Throws on real failures (network, 5xx, auth) so the caller can keep the
   * local row in place and the operator can retry.
   */
  async deleteTemplateFromMeta(accountId: number, templateName: string): Promise<void> {
    if (!accountId) throw new BadRequestException('Cannot delete template: missing account id');
    if (!templateName) throw new BadRequestException('Cannot delete template: missing template name');

    const channel = await this.channels.findOne({
      where: { accountId, status: 'active' },
      order: { lastEventAt: 'DESC', updatedAt: 'DESC' },
    });
    if (!channel) {
      throw new HttpException(`No active WhatsApp channel for account ${accountId}.`, HttpStatus.PRECONDITION_FAILED);
    }
    if (!channel.wabaId) {
      throw new HttpException(`WhatsApp channel ${channel.id} is missing waba_id — reconnect.`, HttpStatus.PRECONDITION_FAILED);
    }

    const resolved = await this.resolver.resolveChannel({
      mode: channel.mode,
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      channelToken: channel.channelToken,
    });

    try {
      await axios.delete(`${resolved.baseUrl}/${channel.wabaId}/message_templates`, {
        params: { name: templateName },
        headers: { Authorization: `Bearer ${resolved.bearerToken}` },
        timeout: 15_000,
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const body = axios.isAxiosError(err) ? err.response?.data : undefined;
      // Meta returns 404 when the template was already deleted (or never
      // existed). That's the desired end-state for us, so swallow it.
      if (status === 404) {
        this.logger.log(`wa_template_delete_already_gone account=${accountId} name=${templateName}`);
        return;
      }
      this.logger.error(`wa_template_delete_failed account=${accountId} name=${templateName} status=${status ?? '?'} body=${this.safe(body)}`);
      throw new HttpException(this.metaErrorMessage(body) ?? 'Meta refused the template delete.', status === 400 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Maps Meta's verdict to the BMS Message.status taxonomy
   * (matches apps/msgops-api/src/modules/messages/messages.interface.ts).
   *  PENDING / IN_APPEAL   → sent_approval (UI badge "Aprovação enviada")
   *  APPROVED              → approved
   *  REJECTED / PAUSED /
   *  DISABLED / PENDING_DELETION → rejected
   */
  normaliseStatus(metaStatus: string): 'approved' | 'rejected' | 'sent_approval' {
    switch (metaStatus.toUpperCase()) {
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
      case 'PAUSED':
      case 'DISABLED':
      case 'PENDING_DELETION':
        return 'rejected';
      default:
        return 'sent_approval';
    }
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

    const body = toMetaBody(content.body ?? '');
    components.push(body.variables.length > 0 ? { type: 'BODY', text: body.text, example: { body_text: [body.examples] } } : { type: 'BODY', text: body.text });

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

    // Operator-chosen category from the messages.template_category column.
    // Legacy rows (pre-1781100000000 migration) have null here, so default to
    // MARKETING to match prior behavior.
    const requested = (messageDto.templateCategory ?? '').toUpperCase();
    const category = VALID_CATEGORIES.has(requested) ? (requested as 'MARKETING' | 'UTILITY') : CATEGORY_MARKETING;

    return {
      name,
      category,
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
