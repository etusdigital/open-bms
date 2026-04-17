export interface SendgridSubUser {
  username: string;
  email: string;
  password: string;
  ips: string[];
}

export interface SendgridSubUserResponse {
  username: string;
  user_id: number;
  email: string;
  credit_allocation: { type: string };
}

export interface SendgridSettingsApiKey {
  name: string;
  scopes: string[];
}

export interface SendgridSettingsApiKeyResponse {
  api_key: string;
  api_key_id: string;
  name: string;
  scopes: string[];
}

export interface SendgridSettingsUnsubscribe {
  enabled: boolean;
  replace: string;
  html_content?: string;
  landing?: string;
  plain_content?: string;
  url?: string;
}

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

export interface SendgridDomainAuthentication {
  domain: string;
  automatic_security: boolean;
  subdomain?: string;
  username?: string;
  ips?: string[];
  custom_dkim_selector?: string;
  custom_spf?: boolean;
  default?: boolean;
}

export interface SendgridDomainAuthenticationResponse {
  id: number;
  user_id: number;
  subdomain: string;
  domain: string;
  username: string;
  ips: string[];
  custom_spf: boolean;
  default: boolean;
  legacy: boolean;
  automatic_security: boolean;
  valid: boolean;
  dns: {
    mail_cname: {
      valid: boolean;
      type: string;
      host: string;
      data: string;
    };
    dkim1: {
      valid: boolean;
      type: string;
      host: string;
      data: string;
    };
    dkim2: {
      valid: boolean;
      type: string;
      host: string;
      data: string;
    };
  };
}

export interface SendgridLinkBranding {
  domain: string;
  subdomain: string;
}

export interface SendgridLinkBrandingResponse extends Omit<SendgridDomainAuthenticationResponse, 'dns' | 'ips' | 'automatic_security' | 'custom_spf'> {
  dns: {
    domain_cname: {
      valid: boolean;
      type: string;
      host: string;
      data: string;
    };
    owner_cname: {
      valid: boolean;
      type: string;
      host: string;
      data: string;
    };
  };
}
