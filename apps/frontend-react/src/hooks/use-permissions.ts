import { useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { Permission } from '@/types';

export function usePermissions() {
  // Read fresh from store at call time to avoid stale closures
  const can = useCallback((permission: Permission) => {
    const { auth } = useAppStore.getState();
    if (auth.status !== 'authenticated') return false;
    return auth.effectiveRole === 'super_admin' || auth.permissions.has(permission);
  }, []);

  return { can };
}
