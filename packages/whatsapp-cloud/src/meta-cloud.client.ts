import axios, { AxiosInstance } from 'axios';
import type { ExchangeCodeForTokenInput, ExchangeCodeForTokenResult, MetaCloudClientOptions, PhoneNumberInfo } from './types';

const DEFAULT_GRAPH_VERSION = 'v18.0';

export class MetaCloudClient {
  private readonly graphVersion: string;
  private readonly http: AxiosInstance;

  constructor(options: MetaCloudClientOptions = {}) {
    this.graphVersion = options.graphVersion ?? DEFAULT_GRAPH_VERSION;
    this.http = axios.create({
      baseURL: 'https://graph.facebook.com',
      timeout: options.timeoutMs ?? 15_000,
    });
  }

  /**
   * Exchanges an Embedded-Signup `code` for a long-lived `access_token`.
   *
   * Calls `GET /{graphVersion}/oauth/access_token` on `graph.facebook.com`.
   */
  async exchangeCodeForToken(input: ExchangeCodeForTokenInput): Promise<ExchangeCodeForTokenResult> {
    const graphVersion = input.graphVersion ?? this.graphVersion;
    const { data } = await this.http.get<{ access_token: string; token_type?: string; expires_in?: number }>(`/${graphVersion}/oauth/access_token`, {
      params: {
        client_id: input.appId,
        client_secret: input.appSecret,
        code: input.code,
      },
    });

    if (!data?.access_token) {
      throw new Error('Meta oauth/access_token response missing access_token');
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
    };
  }

  async getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<PhoneNumberInfo> {
    const { data } = await this.http.get<PhoneNumberInfo>(`/${this.graphVersion}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  }
}
