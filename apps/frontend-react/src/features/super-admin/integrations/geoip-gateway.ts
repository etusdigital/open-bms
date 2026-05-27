import { apiClient } from '@/lib/api-client';

export type GeoIpMode = 'disabled' | 'lite' | 'advanced';
export type GeoIpProvider = 'dbip-full' | 'maxmind' | 'ip-api' | 'ipinfo';

export interface GeoIpAdminSettings {
  mode: GeoIpMode;
  provider?: GeoIpProvider;
  // apiKey is never returned in full — only a masked preview when present.
  apiKeyMasked?: string;
  // accountId is not a secret (MaxMind only).
  accountId?: string;
  // licenseKey existence flag (MaxMind only).
  hasLicenseKey?: boolean;
}

export interface GeoIpSavePayload {
  mode: GeoIpMode;
  provider?: GeoIpProvider;
  // Credentials are optional: if omitted and the provider is unchanged, the
  // backend keeps the existing value. Supply a value only to replace it.
  apiKey?: string;
  accountId?: string;
  licenseKey?: string;
}

export const geoIpSettingsGateway = {
  async get(): Promise<GeoIpAdminSettings | null> {
    const res = await apiClient.get<GeoIpAdminSettings | null>('/admin/geoip/settings');
    return res.data;
  },

  async save(payload: GeoIpSavePayload): Promise<GeoIpAdminSettings> {
    const res = await apiClient.put<GeoIpAdminSettings>('/admin/geoip/settings', payload);
    return res.data;
  },
};
