import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { SuperAdminAccountForm } from './account-form';
import {
  useSuperAdminAccount,
  useCreateSuperAdminAccount,
  useUpdateSuperAdminAccount,
} from './use-super-admin-accounts';
import type { SuperAdminCreateAccountValues, SuperAdminEditAccountValues } from './account-schema';

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

  const handleCreate = (data: SuperAdminCreateAccountValues) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/super-admin/accounts', search: {} as never });
      },
    });
  };

  const handleEdit = (data: SuperAdminEditAccountValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/super-admin/accounts', search: {} as never });
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
            defaultValues={{
              name: accountQuery.data.name,
              description: accountQuery.data.description ?? '',
              isInternal: accountQuery.data.isInternal,
            }}
            onSubmit={handleEdit}
            isPending={updateMutation.isPending}
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
