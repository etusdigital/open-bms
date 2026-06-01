import { apiClient } from '@/lib/api-client';

export type TwilioConfigSource = 'account' | 'none';

export interface AccountTwilioSettings {
  source: TwilioConfigSource;
  accountSidMasked: string | null;
  hasSecret: boolean;
  hasAuthToken: boolean;
  hasSms: boolean;
  hasWhatsapp: boolean;
}

export interface SaveAccountTwilioPayload {
  accountSid: string;
  apiSid: string;
  apiSecret: string;
  authToken?: string;
  smsServiceSid?: string;
  whatsappServiceSid?: string;
}

export interface TwilioTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountTwilioGateway = {
  async get(accountId: number): Promise<AccountTwilioSettings> {
    const res = await apiClient.get<AccountTwilioSettings>(`/accounts/${accountId}/settings/twilio`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountTwilioPayload): Promise<AccountTwilioSettings> {
    const res = await apiClient.put<AccountTwilioSettings>(`/accounts/${accountId}/settings/twilio`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/twilio`);
  },

  async test(accountId: number, creds: { accountSid: string; apiSid: string; apiSecret: string }): Promise<TwilioTestResult> {
    const res = await apiClient.post<TwilioTestResult>(`/accounts/${accountId}/settings/twilio/test`, creds);
    return res.data;
  },
};
