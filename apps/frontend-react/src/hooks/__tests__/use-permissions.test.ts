import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../use-permissions';
import { useAppStore } from '@/stores/app-store';

describe('usePermissions', () => {
  beforeEach(() => {
    useAppStore.setState({
      auth: { status: 'idle' },
      sidebarCollapsed: false,
      savedAccountId: null,
    });
  });

  function authenticateWith(permissions: string[], effectiveRole: import('@/types').RoleCode = 'admin') {
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
      permissions: permissions as any,
      effectiveRole,
      globalRole: null,
      isMasterUser: false,
      accountConfigs: [],
      timezone: 'UTC',
    });
  }

  it('returns false when not authenticated', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('analytics:dashboard_view')).toBe(false);
  });

  it('returns true for granted permissions', () => {
    authenticateWith(['analytics:dashboard_view', 'campaigns:view']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('analytics:dashboard_view')).toBe(true);
    expect(result.current.can('campaigns:view')).toBe(true);
  });

  it('returns false for missing permissions', () => {
    authenticateWith(['analytics:dashboard_view']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('campaigns:view')).toBe(false);
  });

  it('super_admin bypasses all permission checks', () => {
    authenticateWith([], 'super_admin');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('analytics:dashboard_view')).toBe(true);
    expect(result.current.can('campaigns:view')).toBe(true);
    expect(result.current.can('account:settings_view')).toBe(true);
  });

  it('reads fresh state on each call (no stale closures)', () => {
    authenticateWith(['analytics:dashboard_view']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('campaigns:view')).toBe(false);

    // Change permissions in store
    authenticateWith(['analytics:dashboard_view', 'campaigns:view']);
    // Same hook, fresh state
    expect(result.current.can('campaigns:view')).toBe(true);
  });
});
