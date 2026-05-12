export type SettingsTab = 'general' | 'email' | 'email_providers' | 'pool';

// Default tabs for any authenticated user. Super-admin-only tabs ('pool')
// are appended dynamically in settings-page.tsx. GeoIP moved to
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email', 'email_providers'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
