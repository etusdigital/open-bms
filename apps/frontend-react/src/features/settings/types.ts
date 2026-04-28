export type SettingsTab = 'general' | 'email';

export const SETTINGS_TABS: SettingsTab[] = ['general', 'email'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
