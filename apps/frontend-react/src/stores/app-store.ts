import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Permission, RoleCode, Account, UserAccountMe, AccountConfig, AccountChannels } from '@/types';

// User info stored in the auth state (subset common to User and MeResponse)
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  providerId: string;
  status: string;
}

// Auth lifecycle as discriminated union (prevents impossible states)
type AuthStatus =
  | { status: 'idle' }
  | { status: 'authenticating' }
  | {
      status: 'authenticated';
      user: AuthUser;
      account: Account;
      userAccounts: UserAccountMe[];
      permissions: Set<Permission>;
      effectiveRole: RoleCode;
      globalRole: RoleCode | null;
      isMasterUser: boolean;
      accountConfigs: AccountConfig[];
      timezone: string;
    }
  | { status: 'switching'; user: AuthUser; previousAccountId: number }
  | { status: 'error'; error: string };

interface AppState {
  auth: AuthStatus;
  sidebarCollapsed: boolean;
  savedAccountId: number | null;

  // Actions
  setAuthenticating: () => void;
  setAuthenticated: (data: {
    user: AuthUser;
    account: Account;
    userAccounts: UserAccountMe[];
    permissions: Permission[];
    effectiveRole: RoleCode;
    globalRole: RoleCode | null;
    isMasterUser: boolean;
    accountConfigs: AccountConfig[];
    timezone: string;
  }) => void;
  setSwitching: (user: AuthUser, previousAccountId: number) => void;
  setError: (error: string) => void;
  resetAuth: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,

      setAuthenticating: () => set({ auth: { status: 'authenticating' } }),

      setAuthenticated: (data) =>
        set({
          auth: {
            status: 'authenticated',
            user: data.user,
            account: data.account,
            userAccounts: data.userAccounts,
            permissions: new Set(data.permissions),
            effectiveRole: data.effectiveRole,
            globalRole: data.globalRole,
            isMasterUser: data.isMasterUser,
            accountConfigs: data.accountConfigs,
            timezone: data.timezone,
          },
          savedAccountId: data.account.id,
        }),

      setSwitching: (user, previousAccountId) => set({ auth: { status: 'switching', user, previousAccountId } }),

      setError: (error) => set({ auth: { status: 'error', error } }),

      resetAuth: () => set({ auth: { status: 'idle' }, savedAccountId: null }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'bms-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        savedAccountId: state.savedAccountId,
      }),
      version: 1,
    },
  ),
);

// Selectors (derived state, not stored)
export const selectIsSuperAdmin = (s: AppState) =>
  s.auth.status === 'authenticated' && s.auth.effectiveRole === 'super_admin';

export const selectIsSupportUser = (s: AppState) =>
  s.auth.status === 'authenticated' && s.auth.effectiveRole === 'support';

export const selectAccountChannels = (s: AppState): AccountChannels => {
  if (s.auth.status !== 'authenticated')
    return {
      email: false,
      sms: false,
      webPush: false,
      mobilePush: false,
      whatsapp: false,
    };
  const configs = s.auth.accountConfigs;
  const getSettings = (name: string): { isActive?: boolean } => {
    const config = configs.find((c) => c.name === name);
    if (!config?.value) return {};
    try {
      return JSON.parse(config.value);
    } catch {
      return {};
    }
  };
  return {
    email: !!getSettings('email_settings').isActive,
    sms: !!getSettings('sms_settings').isActive,
    webPush: !!getSettings('webpush_settings').isActive,
    mobilePush: !!getSettings('mobilepush_settings').isActive,
    whatsapp: !!getSettings('whatsapp_settings').isActive,
  };
};
