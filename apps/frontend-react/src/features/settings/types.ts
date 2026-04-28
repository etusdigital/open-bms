export type SettingsTab = 'general' | 'email' | 'sendgrid';

// Default tabs for any authenticated user. The 'sendgrid' tab is appended
// dynamically in settings-page.tsx based on selectIsSuperAdmin.
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
