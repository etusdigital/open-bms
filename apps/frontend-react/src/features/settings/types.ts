export type SettingsTab = 'general' | 'email' | 'sendgrid' | 'pool';

// Default tabs for any authenticated user. The 'sendgrid' tab here is the
// per-account SendGrid configuration (key + auto-registered webhook). The
// platform-wide global fallback key lives in a separate super-admin panel
// outside this page — it has no place in account settings since it is not
// scoped to a single tenant. The 'pool' tab is appended in
// settings-page.tsx for super-admins only.
export const SETTINGS_TABS: SettingsTab[] = ['general', 'email', 'sendgrid'];

export interface AccountConfigUpdate {
  account_id: number;
  name: string;
  value: string;
}
