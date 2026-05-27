import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { SuperAdminUserForm } from './user-form';
import { useSuperAdminUser, useCreateSuperAdminUser, useUpdateSuperAdminUser } from './use-super-admin-users';
import type { SuperAdminCreateUserValues, SuperAdminEditUserValues } from './user-schema';

interface SuperAdminUserFormPageProps {
  userId?: number;
}

export function SuperAdminUserFormPage({ userId }: SuperAdminUserFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = userId !== undefined;

  const userQuery = useSuperAdminUser(isEditing ? userId : 0);
  const createMutation = useCreateSuperAdminUser();
  const updateMutation = useUpdateSuperAdminUser(userId ?? 0);

  const handleCreate = (data: SuperAdminCreateUserValues) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/super-admin/users', search: {} as never });
      },
    });
  };

  const handleEdit = (data: SuperAdminEditUserValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/super-admin/users', search: {} as never });
      },
    });
  };

  if (isEditing && userQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('superAdmin.users.edit')}
          backTo="/super-admin/users"
          backLabel={t('superAdmin.users.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && userQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('superAdmin.users.edit')}
          backTo="/super-admin/users"
          backLabel={t('superAdmin.users.pageTitle')}
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
        title={isEditing ? t('superAdmin.users.edit') : t('superAdmin.users.createUser')}
        backTo="/super-admin/users"
        backLabel={t('superAdmin.users.pageTitle')}
      />
      <FormPage.Content>
        {isEditing && userQuery.data ? (
          <SuperAdminUserForm
            key={userQuery.data.id}
            mode="edit"
            userId={userId}
            defaultValues={{
              name: userQuery.data.name,
              email: userQuery.data.email,
              globalRoleCode: (userQuery.data.globalRole?.code as never) ?? 'editor',
            }}
            memberships={userQuery.data.userAccount ?? []}
            onSubmit={handleEdit}
            isPending={updateMutation.isPending}
          />
        ) : (
          <SuperAdminUserForm
            mode="create"
            onSubmit={handleCreate}
            isPending={createMutation.isPending}
          />
        )}
      </FormPage.Content>
    </FormPage.Root>
  );
}
