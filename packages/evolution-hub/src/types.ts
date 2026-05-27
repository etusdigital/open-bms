export interface EvolutionHubClientOptions {
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
}

export type HubChannelType = 'whatsapp' | 'facebook' | 'instagram';

/**
 * Input to POST /api/v1/channels (single-shot create + webhook association).
 *
 * Matches the Go handler at evolution-hub/backend/pkg/channel/handler/channel_handler.go:45
 * (CreateChannelRequest). When webhook_url is set the Hub creates the channel
 * AND associates a webhook in one call — used by the BMS to wire up the
 * outbound webhook automatically on channel create.
 */
export interface CreateChannelInput {
  name: string;
  type?: HubChannelType;
  /** Cross-reference id from the BMS side (e.g. our account id). */
  external_id?: string;
  webhook_url?: string;
  webhook_secret?: string;
  /** Restrict the events the webhook should receive (e.g. ['messages','message_template_status_update']). Empty array / undefined = all. */
  webhook_events?: string[];
  /** Optional BYO Meta App credential id (uuid). When set the channel runs under the user's own Meta App. */
  channel_credentials_id?: string;
}

/**
 * Raw response from POST /api/v1/channels. The Hub returns
 *   { channel: ChannelResponse, webhook_id?: string }
 * when webhook_url was provided, else the ChannelResponse directly.
 *
 * `channel.token` is the public token used to build the connect URL
 * ({HUB_FRONTEND_URL}/connect/{token}) — that URL is what the admin opens
 * in a new tab to finish Embedded Signup.
 */
export interface HubChannel {
  id: string;
  name: string;
  type: HubChannelType;
  token: string;
  status: string;
  external_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateChannelResult {
  channel: HubChannel;
  webhook_id?: string;
}

export interface ChannelSummary {
  id: string;
  status: string;
  display_phone_number?: string;
  phone_number_id?: string;
  waba_id?: string;
}

export interface HubPlan {
  plan: string;
  channels_used: number;
  channels_limit: number;
  features?: string[];
}

export interface MetaAppOption {
  id: string;
  name: string;
  config_id?: string;
}
