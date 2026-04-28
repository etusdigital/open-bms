export type SettingsTab = 'general' | 'email' | 'sendgrid' | 'pool';

// Default tabs for any authenticated user. The 'sendgrid' and 'pool' tabs are
// appended dynamically in settings-page.tsx based on selectIsSuperAdmin.
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
