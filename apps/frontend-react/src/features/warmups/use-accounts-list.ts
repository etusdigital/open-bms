import { useMemo } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { SelectOption } from '@/features/segments/builder/searchable-api-select';

export function useAccountsList(): SelectOption[] {
  const auth = useAppStore((s) => s.auth);

  return useMemo(() => {
    if (auth.status !== 'authenticated') return [];
    return auth.userAccounts.map((acc) => ({
      value: String(acc.accountId),
      label: acc.account.name,
    }));
  }, [auth]);
}
