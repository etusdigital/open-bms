import { apiClient } from '@/lib/api-client';

export type SendgridKeySource = 'account' | 'none';

/**
 * Shape returned by GET/PUT `/accounts/:id/settings/sendgrid`. Carries a `webhookUrl`
 * on top of the standard ProviderCardGateway response so the SendGrid card can render
 * the webhook URL in its `footerSlot`.
 */
export interface AccountSendgridSettings {
  source: SendgridKeySource;
  apiKeyMasked: string | null;
  webhookUrl: string | null;
}

export interface SendgridTestResponse {
  accountName: string | null;
}

/**
 * ProviderCardGateway-compatible wrapper around the per-account SendGrid endpoints.
 * - `get`/`save` return the wider `AccountSendgridSettings` shape (extra `webhookUrl`
 *   field is ignored by ProviderCard but consumed by SendgridCard for the footer).
 * - `test` is reshaped from `{ accountName }` to the `{ ok, errorMessage }` contract
 *   expected by ProviderCard.
 */
export const accountSendgridGateway = {
  async get(accountId: number): Promise<AccountSendgridSettings> {
    const res = await apiClient.get<AccountSendgridSettings>(`/accounts/${accountId}/settings/sendgrid`);
    return res.data;
  },

  async save(accountId: number, payload: { apiKey: string }): Promise<AccountSendgridSettings> {
    const res = await apiClient.put<AccountSendgridSettings>(`/accounts/${accountId}/settings/sendgrid`, payload);
    return res.data;
  },

  async remove(accountId: number): Promise<void> {
    await apiClient.delete(`/accounts/${accountId}/settings/sendgrid`);
  },

  async test(accountId: number, apiKey: string): Promise<{ ok: boolean; errorMessage?: string }> {
    try {
      const res = await apiClient.post<SendgridTestResponse>(`/accounts/${accountId}/settings/sendgrid/test`, { apiKey });
      return { ok: true, errorMessage: res.data?.accountName ?? undefined };
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? null)
          : null;
      return { ok: false, errorMessage: message ?? undefined };
    }
  },
};
