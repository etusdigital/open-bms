import { apiClient } from '@/lib/api-client';

export type SparkpostKeySource = 'account' | 'none';

export interface AccountSparkpostSettings {
  source: SparkpostKeySource;
  apiKeyMasked: string | null;
}

export interface SaveAccountSparkpostPayload {
  apiKey: string;
}

export interface SparkpostTestResult {
  ok: boolean;
  errorMessage?: string;
}

export const accountSparkpostGateway = {
  async get(accountId: number): Promise<AccountSparkpostSettings> {
    const res = await apiClient.get<AccountSparkpostSettings>(`/accounts/${accountId}/settings/sparkpost`);
    return res.data;
  },

  async save(accountId: number, payload: SaveAccountSparkpostPayload): Promise<AccountSparkpostSettings> {
    const res = await apiClient.put<AccountSparkpostSettings>(`/accounts/${accountId}/settings/sparkpost`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/sparkpost`);
  },

  async test(accountId: number, apiKey: string): Promise<SparkpostTestResult> {
    const res = await apiClient.post<SparkpostTestResult>(`/accounts/${accountId}/settings/sparkpost/test`, { apiKey });
    return res.data;
  },
};
