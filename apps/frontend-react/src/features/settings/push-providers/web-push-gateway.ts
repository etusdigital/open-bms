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
  // Drive the install snippet's cookieDomain + cookiesToSearch[]. Editable in the
  // UI; persisted as the account configs default_domain + webpush_cookies_to_search.
  defaultDomain?: string;
  cookiesToSearch?: string[];
}

// Payload for saveSettings: the popup WebPushSettings plus the two snippet-driving
// configs. The backend splits defaultDomain / cookiesToSearch off into their own
// account configs (see saveWebPushSettings).
export type WebPushSavePayload = WebPushSettings & {
  defaultDomain?: string;
  cookiesToSearch?: string[];
};

export const webPushGateway = {
  async getIntegration(accountId: number): Promise<WebPushIntegration> {
    const res = await apiClient.get<WebPushIntegration>(`/accounts/${accountId}/web-push/integration`);
    return res.data;
  },

  async saveSettings(accountId: number, settings: WebPushSavePayload): Promise<{ ok: true }> {
    const res = await apiClient.put<{ ok: true }>(`/accounts/${accountId}/web-push/settings`, settings);
    return res.data;
  },

  async regenerateSw(accountId: number): Promise<{ serviceWorkerUrl: string | null }> {
    const res = await apiClient.post<{ serviceWorkerUrl: string | null }>(`/accounts/${accountId}/web-push/regenerate-sw`, {});
    return res.data;
  },
};
