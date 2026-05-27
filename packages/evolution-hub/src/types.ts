export interface EvolutionHubClientOptions {
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface CreateChannelInput {
  name: string;
  /** Optional external account identifier for cross-reference in the Hub. */
  external_account_id?: string | number;
  /** Webhook URL the Hub should call for channel lifecycle and Meta events. */
  webhook_url?: string;
}

export interface ChannelCreateResult {
  id: string;
  public_link: string;
  channel_token: string;
  status?: string;
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
