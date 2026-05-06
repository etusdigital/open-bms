export type SettingsTab = 'general' | 'email' | 'sendgrid' | 'pool' | 'geoip';

// Default tabs for any authenticated user. Super-admin-only tabs ('pool',
// 'geoip') are appended dynamically in settings-page.tsx.
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email', 'sendgrid'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
