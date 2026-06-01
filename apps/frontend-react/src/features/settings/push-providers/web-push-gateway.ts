import { apiClient } from '@/lib/api-client';

// Opt-in popup + URL filter settings. Single-project model: NO Firebase/VAPID
// here — those live in the platform FCM config. The account only sets the popup
// behavior and which URLs it shows on.
export interface WebPushSettings {
  isActive?: boolean;
  urlFilterShow?: string;
  urlFilterHide?: string;
  // opt-in popup builder fields:
  optinTitle?: string;
  optinBody?: string;
  optinAllowLabel?: string;
  optinDenyLabel?: string;
  position?: 'top' | 'bottom' | 'center';
  backgroundColor?: string;
  // trigger: 'onload' | 'delay' | 'scroll' | 'inactivity'
  trigger?: string;
  triggerDelaySeconds?: number;
  triggerScrollPercent?: number;
  triggerInactivitySeconds?: number;
  // mobile variant (optional overrides)
  mobilePosition?: 'top' | 'bottom' | 'center';
  [key: string]: unknown;
}

export interface WebPushIntegration {
  serviceWorkerUrl: string | null;
  snippet: string;
  settings: WebPushSettings | null;
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
