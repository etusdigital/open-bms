export type SettingsTab = 'general' | 'email' | 'email_providers' | 'whatsapp' | 'twilio' | 'push' | 'api_keys' | 'pool';

// Default tabs for any authenticated user. Super-admin-only tabs ('pool')
// are appended dynamically in settings-page.tsx.
// Keep tab keys single-word so the i18n key `settings.tab${Capitalize(key)}`
// resolves cleanly (e.g. 'twilio' → settings.tabTwilio).
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email', 'email_providers', 'whatsapp', 'twilio', 'push', 'api_keys'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
