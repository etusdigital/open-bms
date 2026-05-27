import axios, { AxiosInstance } from 'axios';
import type { ChannelSummary, CreateChannelInput, CreateChannelResult, EvolutionHubClientOptions, HubChannel, HubPlan, MetaAppOption } from './types';

const DEFAULT_BASE_URL = 'https://api.evohub.ai';

/**
 * Public-facing URL of the EvoHub frontend. Embedded Signup lives at
 * `{HUB_FRONTEND_URL}/connect/{channel.token}` — that's what the admin opens
 * in a new tab to finish the WhatsApp connection.
 *
 * Hardcoded for the same reason as HUB_API_URL in the CRM: it's an Evo
 * Foundation-owned endpoint, not configurable per install.
 */
export const HUB_FRONTEND_URL = 'https://app.evohub.evolutionfoundation.com.br';

/**
 * Builds the public signup URL for a freshly created channel.
 */
export function buildHubSignupUrl(channelToken: string): string {
  return `${HUB_FRONTEND_URL}/connect/${encodeURIComponent(channelToken)}`;
}

export class EvolutionHubClient {
  private readonly http: AxiosInstance;

  constructor(options: EvolutionHubClientOptions) {
    if (!options.apiKey) {
      throw new Error('EvolutionHubClient requires an apiKey');
    }
    this.http = axios.create({
      baseURL: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
      timeout: options.timeoutMs ?? 15_000,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Single-shot create: persists the channel AND associates a webhook in one
   * call when `webhook_url` is set. Returns the inner channel + the optional
   * webhook_id the Hub assigned.
   *
   * Matches POST /api/v1/channels in the Go backend
   * (evolution-hub/backend/pkg/channel/handler/channel_handler.go).
   */
  async createChannel(input: CreateChannelInput): Promise<CreateChannelResult> {
    const { data } = await this.http.post<HubChannel | CreateChannelResult>('/api/v1/channels', input);

    // Hub returns `{ channel, webhook_id? }` only when webhook_url was set;
    // otherwise it returns the channel JSON directly. Normalize so callers
    // get a single shape.
    if (data && typeof data === 'object' && 'channel' in (data as object)) {
      const wrapped = data as CreateChannelResult;
      if (!wrapped.channel?.id || !wrapped.channel?.token) {
        throw new Error('EvoHub createChannel response missing channel.id / channel.token');
      }
      return wrapped;
    }
    const channel = data as HubChannel;
    if (!channel?.id || !channel?.token) {
      throw new Error('EvoHub createChannel response missing id / token');
    }
    return { channel };
  }

  async deleteChannel(id: string): Promise<void> {
    await this.http.delete(`/api/v1/channels/${encodeURIComponent(id)}`);
  }

  /**
   * Creates a standalone webhook and (optionally) associates it with one or
   * more existing channels in a single call. Used when the BMS wants to
   * attach itself to a channel that's already connected through the Hub by
   * another system — Embedded Signup is skipped, only the webhook is set up.
   *
   * Matches POST /api/v1/webhooks in the Go backend
   * (evolution-hub/backend/pkg/webhook/handler/webhook_handler.go:86).
   */
  async createWebhook(input: {
    name: string;
    url: string;
    events?: string[];
    secret?: string;
    channels?: string[];
  }): Promise<{ id: string }> {
    const { data } = await this.http.post<{ id: string }>('/api/v1/webhooks', {
      name: input.name,
      url: input.url,
      events: input.events ?? [],
      secret: input.secret,
      channels: input.channels ?? [],
    });
    if (!data?.id) throw new Error('EvoHub createWebhook response missing id');
    return { id: data.id };
  }

  /**
   * Deletes a webhook resource. The Hub's channel_webhooks join table is
   * cleaned up on DELETE /channels/:id (cascade), but the webhook row itself
   * stays orphaned. Call this after deleteChannel when you also created
   * the webhook through createChannel's single-shot.
   */
  async deleteWebhook(id: string): Promise<void> {
    await this.http.delete(`/api/v1/webhooks/${encodeURIComponent(id)}`);
  }

  async listChannels(): Promise<ChannelSummary[]> {
    // Hub returns `{ channels: [...], count: N }` — see GetChannels handler in
    // evolution-hub/backend/pkg/channel/handler/channel_handler.go:229.
    // Old code that consumed `data` directly hit "remote.filter is not a
    // function" because data is an object, not an array.
    const { data } = await this.http.get<{ channels?: ChannelSummary[] } | ChannelSummary[]>('/api/v1/channels');
    if (Array.isArray(data)) return data;
    return data?.channels ?? [];
  }

  async getChannel(id: string): Promise<ChannelSummary> {
    const { data } = await this.http.get<ChannelSummary>(`/api/v1/channels/${encodeURIComponent(id)}`);
    return data;
  }

  async getPlan(): Promise<HubPlan> {
    const { data } = await this.http.get<HubPlan>('/api/v1/plan');
    return data;
  }

  async getMetaAppOptions(): Promise<MetaAppOption[]> {
    const { data } = await this.http.get<MetaAppOption[]>('/api/v1/meta-apps');
    return data ?? [];
  }
}
