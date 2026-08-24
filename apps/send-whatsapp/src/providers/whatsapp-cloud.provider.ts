import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';

export interface WhatsappCloudProviderConfig {
  /** Full URL prefix up to (and including) the Graph API version segment.
   *   Meta direct: `https://graph.facebook.com/v18.0`
   *   EvoHub:      `https://api.evohub.ai/meta/v18.0`
   */
  baseUrl: string;
  /** Either Meta access_token (meta mode) or EvoHub channel_token (evohub mode). */
  bearerToken: string;
  /** Phone number id (NOT the e164 number) — comes from Embedded Signup / webhook. */
  phoneNumberId: string;
  /** Optional override of axios timeout. Default 15s. */
  timeoutMs?: number;
}

export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  components?: unknown[];
}

export interface SendTextInput {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface MetaMessageResponse {
  messaging_product: 'whatsapp';
  contacts?: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

/**
 * Wave 5 — unified send provider for WhatsApp Cloud API.
 *
 * The same wire protocol (POST {baseUrl}/{phoneNumberId}/messages with
 * Authorization: Bearer {token}) covers both modes — what changes per
 * install is only baseUrl + bearerToken, which the WhatsappModeResolverService
 * already produces. That means one provider class works for Meta direct and
 * EvoHub turnkey without any branching at the call site.
 *
 * Retries 5xx/429 and Meta throughput errors (130429, 131056, 80007) up to
 * 5 times with exponential backoff (500ms .. 8s). Other 4xx never retry.
 */
@Injectable()
export class WhatsappCloudProvider {
  private static readonly RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
  private static readonly RETRYABLE_META_CODES = new Set([130429, 131056, 80007]);
  private static readonly MAX_RETRIES = 5;
  private static readonly BASE_DELAY_MS = 500;
  private readonly logger = new Logger(WhatsappCloudProvider.name);
  private readonly http: AxiosInstance;
  private readonly phoneNumberId: string;

  constructor(config: WhatsappCloudProviderConfig) {
    if (!config.baseUrl) throw new Error('WhatsappCloudProvider: baseUrl is required');
    if (!config.bearerToken) throw new Error('WhatsappCloudProvider: bearerToken is required');
    if (!config.phoneNumberId) throw new Error('WhatsappCloudProvider: phoneNumberId is required');
    this.phoneNumberId = config.phoneNumberId;
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      timeout: config.timeoutMs ?? 15_000,
      headers: {
        Authorization: `Bearer ${config.bearerToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendTemplate(input: SendTemplateInput): Promise<MetaMessageResponse> {
    return this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.normaliseNumber(input.to),
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(input.components?.length ? { components: input.components } : {}),
      },
    });
  }

  async sendText(input: SendTextInput): Promise<MetaMessageResponse> {
    return this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.normaliseNumber(input.to),
      type: 'text',
      text: { body: input.text, preview_url: input.previewUrl ?? false },
    });
  }

  private async post(body: Record<string, unknown>): Promise<MetaMessageResponse> {
    const path = `/${encodeURIComponent(this.phoneNumberId)}/messages`;
    for (let attempt = 1; attempt <= WhatsappCloudProvider.MAX_RETRIES; attempt++) {
      try {
        const { data } = await this.http.post<MetaMessageResponse>(path, body);
        return data;
      } catch (err) {
        const isLast = attempt === WhatsappCloudProvider.MAX_RETRIES;
        const status = (err as AxiosError)?.response?.status;
        if (!this.isRetryable(err as AxiosError) || isLast) {
          this.logFailure(err as AxiosError, attempt);
          throw err;
        }
        const delay = WhatsappCloudProvider.BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(`wa_cloud_retry attempt=${attempt}/${WhatsappCloudProvider.MAX_RETRIES} status=${status} delay=${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    // Unreachable — the loop either returns or throws — but TS needs it.
    throw new Error('WhatsappCloudProvider: exhausted retries');
  }

  private isRetryable(err: AxiosError): boolean {
    const status = err?.response?.status;
    if (!status) return false;
    if (WhatsappCloudProvider.RETRYABLE_STATUSES.has(status)) return true;
    const metaCode = (err.response?.data as { error?: { code?: number } } | undefined)?.error?.code;
    return metaCode !== undefined && WhatsappCloudProvider.RETRYABLE_META_CODES.has(metaCode);
  }

  /** WhatsApp Cloud API expects E.164 without "+" and without `whatsapp:` prefix. */
  private normaliseNumber(raw: string): string {
    return raw
      .replace(/^whatsapp:/i, '')
      .replace(/^\+/, '')
      .trim();
  }

  private logFailure(err: AxiosError, attempt: number): void {
    const status = err.response?.status;
    const errPayload = err.response?.data;
    // Mask any accidental leak of the Authorization header in error.config —
    // shouldn't happen with axios's default error shape, but cheap to enforce.
    const cfg = err.config as { url?: string } | undefined;
    this.logger.error(`wa_cloud_send_failed attempt=${attempt} status=${status ?? 'no-status'} path=${cfg?.url ?? '?'} body=${this.safeStringify(errPayload)}`);
  }

  private safeStringify(value: unknown): string {
    try {
      const str = JSON.stringify(value);
      return str?.slice(0, 500) ?? 'null';
    } catch {
      return '[unstringifiable]';
    }
  }
}
