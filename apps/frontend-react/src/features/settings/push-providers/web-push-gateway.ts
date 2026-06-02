import { apiClient } from '@/lib/api-client';
import type { WebPushSettings } from './web-push-template';

// Opt-in popup + URL filter settings. Single-project model: NO Firebase/VAPID
// here — those live in the platform FCM config. The account only sets the popup
// behavior and which URLs it shows on.
//
// The stored shape is the FULL WebPushSettings (see web-push-template.ts),
// including the generated html / mobileHtml / scriptToRun — those are the ONLY
// fields web-push.js reads at runtime, so they MUST be persisted.
export type { WebPushSettings } from './web-push-template';

export interface WebPushIntegration {
  serviceWorkerUrl: string | null;
  snippet: string;
  settings: Partial<WebPushSettings> | null;
}

export const webPushGateway = {
  async getIntegration(accountId: number): Promise<WebPushIntegration> {
    const res = await apiClient.get<WebPushIntegration>(`/accounts/${accountId}/web-push/integration`);
    return res.data;
  },

  async saveSettings(accountId: number, settings: WebPushSettings): Promise<{ ok: true }> {
    const res = await apiClient.put<{ ok: true }>(`/accounts/${accountId}/web-push/settings`, settings);
    return res.data;
  },

  async regenerateSw(accountId: number): Promise<{ serviceWorkerUrl: string | null }> {
    const res = await apiClient.post<{ serviceWorkerUrl: string | null }>(`/accounts/${accountId}/web-push/regenerate-sw`, {});
    return res.data;
  },
};
