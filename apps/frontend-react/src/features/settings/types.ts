export type SettingsTab = 'general' | 'email' | 'sendgrid' | 'pool';

// Default tabs for any authenticated user. Super-admin-only tabs ('pool')
// are appended dynamically in settings-page.tsx. GeoIP moved to
// /super-admin/integrations as part of EVO-1034.
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email', 'sendgrid'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
