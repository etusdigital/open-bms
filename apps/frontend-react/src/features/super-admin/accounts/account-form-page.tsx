import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { SuperAdminAccountForm } from './account-form';
import {
  useSuperAdminAccount,
  useCreateSuperAdminAccount,
  useUpdateSuperAdminAccount,
} from './use-super-admin-accounts';
import { useUpdateAccountConfigs } from '@/features/settings/use-settings';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { buildChannelConfigUpdates, extractChannelDefaults } from './account-channels';
import type { SuperAdminCreateAccountValues, SuperAdminEditAccountValues } from './account-schema';
import type { SuperAdminAccount } from './types';
import type { AccountConfig } from '@/types';

interface SuperAdminAccountFormPageProps {
  accountId?: number;
}

export function SuperAdminAccountFormPage({ accountId }: SuperAdminAccountFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = accountId !== undefined;

  const accountQuery = useSuperAdminAccount(isEditing ? accountId : 0);
  const createMutation = useCreateSuperAdminAccount();
  const updateMutation = useUpdateSuperAdminAccount(accountId ?? 0);
  // Suppress this hook's own success toast — the outer flow already toasts
  // on the account update; back-to-back successes read as duplicate UX.
  // Error toast stays on so a configs PUT failure remains visible.
  const updateConfigs = useUpdateAccountConfigs({ silentSuccess: true });

  const handleCreate = (data: SuperAdminCreateAccountValues) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/super-admin/accounts', search: {} as never });
      },
    });
  };

  const handleEdit = (data: SuperAdminEditAccountValues) => {
    if (!isEditing || accountId === undefined) return;
    const { channels, ...accountFields } = data;
    const account = accountQuery.data;
    const channelUpdates = buildChannelConfigUpdates(channels, account?.accountConfigs, accountId);

    // When channels actually changed AND the super-admin is editing the
    // account they're currently logged into, refresh the local store so the
    // automations editor (and other consumers of accountConfigs) reflect the
    // new channel state without requiring a logout/login. Cross-account
    // edits update the DB but can't reach an operator's separate session.
    const finalize = async () => {
      const auth = useAppStore.getState().auth;
      const shouldRefreshStore =
        channelUpdates.length > 0 && auth.status === 'authenticated' && auth.account.id === accountId;
      if (shouldRefreshStore) {
        try {
          const { data: configs } = await apiClient.get<AccountConfig[]>('/accounts/configs');
          useAppStore.getState().setAccountConfigs(configs);
        } catch {
          // Non-fatal: stale store self-heals on next reload.
        }
      }
      navigate({ to: '/super-admin/accounts', search: {} as never });
    };

    updateMutation.mutate(accountFields as SuperAdminEditAccountValues, {
      onSuccess: () => {
        if (channelUpdates.length === 0) {
          // No channel toggle changed — skip the providers call entirely
          // (avoids triggering webpush side-effects on every save).
          void finalize();
          return;
        }
        updateConfigs.mutate(
          { accountId, configs: channelUpdates },
          { onSuccess: () => void finalize() },
        );
      },
    });
  };

  if (isEditing && accountQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('superAdmin.accounts.edit')}
          backTo="/super-admin/accounts"
          backLabel={t('superAdmin.accounts.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && accountQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('superAdmin.accounts.edit')}
          backTo="/super-admin/accounts"
          backLabel={t('superAdmin.accounts.pageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const editDefaults = (account: SuperAdminAccount): SuperAdminEditAccountValues => ({
    name: account.name,
    description: account.description ?? '',
    isInternal: account.isInternal,
    channels: extractChannelDefaults(account.accountConfigs),
  });

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('superAdmin.accounts.edit') : t('superAdmin.accounts.createAccount')}
        backTo="/super-admin/accounts"
        backLabel={t('superAdmin.accounts.pageTitle')}
      />
      <FormPage.Content>
        {isEditing && accountQuery.data ? (
          <SuperAdminAccountForm
            key={accountQuery.data.id}
            mode="edit"
            defaultValues={editDefaults(accountQuery.data)}
            onSubmit={handleEdit}
            isPending={updateMutation.isPending || updateConfigs.isPending}
          />
        ) : (
          <SuperAdminAccountForm
            mode="create"
            onSubmit={handleCreate}
            isPending={createMutation.isPending}
          />
        )}
      </FormPage.Content>
    </FormPage.Root>
  );
}
