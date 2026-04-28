import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, selectIsSuperAdmin, selectIsSupportUser, selectAccountChannels } from '../app-store';

describe('store selectors', () => {
  beforeEach(() => {
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
  });

  function authenticateWith(overrides: Record<string, unknown> = {}) {
    useAppStore.getState().setAuthenticated({
      user: {
        id: 1,
        name: 'Test',
        email: 'test@test.com',
        profile: '',
        providerId: 'auth0|123',
        status: 'active',
      },
      account: {
        id: 1,
        name: 'Account',
        description: '',
        isActive: true,
        isInternal: false,
        groupId: 1,
      },
      userAccounts: [],
      permissions: [],
      effectiveRole: 'admin' as const,
      globalRole: null,
      isMasterUser: false,
      accountConfigs: [],
      timezone: 'UTC',
      ...overrides,
    });
  }

  describe('selectIsSuperAdmin', () => {
    it('returns false when not authenticated', () => {
      expect(selectIsSuperAdmin(useAppStore.getState())).toBe(false);
    });

    it('returns true for super_admin role', () => {
      authenticateWith({ effectiveRole: 'super_admin' });
      expect(selectIsSuperAdmin(useAppStore.getState())).toBe(true);
    });

    it('returns false for other roles', () => {
      authenticateWith({ effectiveRole: 'admin' });
      expect(selectIsSuperAdmin(useAppStore.getState())).toBe(false);
    });
  });

  describe('selectIsSupportUser', () => {
    it('returns false when not authenticated', () => {
      expect(selectIsSupportUser(useAppStore.getState())).toBe(false);
    });

    it('returns true for support role', () => {
      authenticateWith({ effectiveRole: 'support' });
      expect(selectIsSupportUser(useAppStore.getState())).toBe(true);
    });
  });

  describe('selectAccountChannels', () => {
    it('returns all false when not authenticated', () => {
      expect(selectAccountChannels(useAppStore.getState())).toEqual({
        email: false,
        sms: false,
        webPush: false,
        mobilePush: false,
        whatsapp: false,
      });
    });

    it('returns all false when no channel configs exist', () => {
      authenticateWith();
      const channels = selectAccountChannels(useAppStore.getState());
      expect(channels.email).toBe(false);
      expect(channels.sms).toBe(false);
    });

    it('derives channels from *_settings configs with isActive', () => {
      authenticateWith({
        accountConfigs: [
          {
            accountId: 1,
            name: 'email_settings',
            value: JSON.stringify({ isActive: true }),
            isLoadConfig: false,
          },
          {
            accountId: 1,
            name: 'sms_settings',
            value: JSON.stringify({ isActive: true }),
            isLoadConfig: false,
          },
          {
            accountId: 1,
            name: 'webpush_settings',
            value: JSON.stringify({ isActive: true }),
            isLoadConfig: false,
          },
          {
            accountId: 1,
            name: 'whatsapp_settings',
            value: JSON.stringify({ isActive: false }),
            isLoadConfig: false,
          },
        ],
      });
      const channels = selectAccountChannels(useAppStore.getState());
      expect(channels.email).toBe(true);
      expect(channels.sms).toBe(true);
      expect(channels.webPush).toBe(true);
      expect(channels.mobilePush).toBe(false);
      expect(channels.whatsapp).toBe(false);
    });
  });
});
