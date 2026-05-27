export interface ExchangeCodeForTokenInput {
  appId: string;
  appSecret: string;
  code: string;
  graphVersion?: string;
}

export interface ExchangeCodeForTokenResult {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface PhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
}

export interface MetaCloudClientOptions {
  graphVersion?: string;
  timeoutMs?: number;
}
