import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { extractApiErrorMessage } from '@/lib/api-error';
import { useAppStore } from '@/stores/app-store';
import type { AccountConfig } from '@/types';
import type { AccountConfigUpdate } from './types';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

/** Read a config value from the store */
export function useAccountConfig(name: string): string {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return '';
    const config = s.auth.accountConfigs.find((c) => c.name === name);
    return config?.value ?? '';
  });
}

/** Read all account configs from the store */
export function useAccountConfigs(): AccountConfig[] {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return [];
    return s.auth.accountConfigs;
  });
}

/** Read the current account ID */
export function useAccountId(): number {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return 0;
    return s.auth.account.id;
  });
}

/** Read the timezone from the store */
export function useTimezone(): string {
  return useAppStore((s) => {
    if (s.auth.status !== 'authenticated') return '';
    return s.auth.timezone;
  });
}

/** Save account configs */
export function useUpdateAccountConfigs() {
  return useMutation({
    mutationFn: async ({ accountId, configs }: { accountId: number; configs: AccountConfigUpdate[] }) => {
      await apiClient.put(`/accounts/providers/${accountId}`, configs);
    },
    onSuccess: () => {
      toast.success(i18n.t('settings.saveSuccess'));
    },
    onError: (error) => {
      toast.error(extractApiErrorMessage(error) ?? i18n.t('settings.saveError'));
    },
  });
}
