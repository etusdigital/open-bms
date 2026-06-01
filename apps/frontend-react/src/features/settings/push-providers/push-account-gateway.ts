import { apiClient } from '@/lib/api-client';

// 'platform' = no per-account config, but the super-admin/platform Firebase
// credential (env FIREBASE_SERVICE_ACCOUNT) is active as fallback.
export type PushConfigSource = 'account' | 'platform' | 'none';

export interface AccountPushSettings {
  source: PushConfigSource;
  serviceAccountMasked: string | null;
}

export interface SaveAccountPushPayload {
  firebaseServiceAccount: string;
}

export interface PushTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountPushGateway = {
  async get(accountId: number): Promise<AccountPushSettings> {
    const res = await apiClient.get<AccountPushSettings>(`/accounts/${accountId}/settings/push`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountPushPayload): Promise<AccountPushSettings> {
    const res = await apiClient.put<AccountPushSettings>(`/accounts/${accountId}/settings/push`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/push`);
  },

  async test(accountId: number, firebaseServiceAccount: string): Promise<PushTestResult> {
    const res = await apiClient.post<PushTestResult>(`/accounts/${accountId}/settings/push/test`, { firebaseServiceAccount });
    return res.data;
  },
};
