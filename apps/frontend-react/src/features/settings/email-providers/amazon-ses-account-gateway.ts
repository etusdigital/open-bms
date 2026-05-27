import { apiClient } from '@/lib/api-client';

export type SesCredentialsSource = 'account' | 'none';

export interface AccountSesSettings {
  source: SesCredentialsSource;
  accessKeyIdMasked: string | null;
  secretAccessKeyMasked: string | null;
  region: string | null;
}

export interface SaveAccountSesPayload {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface SesTestPayload {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface SesTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountSesGateway = {
  async get(accountId: number): Promise<AccountSesSettings> {
    const res = await apiClient.get<AccountSesSettings>(`/accounts/${accountId}/settings/ses`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountSesPayload): Promise<AccountSesSettings> {
    const res = await apiClient.put<AccountSesSettings>(`/accounts/${accountId}/settings/ses`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/ses`);
  },

  async test(accountId: number, payload: SesTestPayload): Promise<SesTestResult> {
    const res = await apiClient.post<SesTestResult>(`/accounts/${accountId}/settings/ses/test`, payload);
    return res.data;
  },
};
