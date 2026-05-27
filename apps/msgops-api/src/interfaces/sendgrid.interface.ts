export interface SendgridSettingsWebhook {
  enabled: boolean;
  url: string;
  group_resubscribe?: boolean;
  delivered?: boolean;
  group_unsubscribe?: boolean;
  spam_report?: boolean;
  bounce?: boolean;
  deferred?: boolean;
  unsubscribe?: boolean;
  processed?: boolean;
  open?: boolean;
  click?: boolean;
  dropped?: boolean;
  friendly_name?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_token_url?: string;
}
