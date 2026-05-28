// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { useAccountId } from '@/features/settings/use-settings';
import { AccountUserForm } from './user-form';
import {
  useAccountUser,
  useCreateAccountUser,
  useUpdateAccountUserProfile,
  useUpdateAccountUserRole,
} from './use-account-users';
import type { AccountUserCreateValues, AccountUserEditValues } from './user-schema';
import { toAccountRoleCode } from './user-schema';

interface AccountUserFormPageProps {
  userId?: number;
}

export function AccountUserFormPage({ userId }: AccountUserFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accountId = useAccountId();
  const isEditing = userId !== undefined;

  const userQuery = useAccountUser(isEditing ? userId : 0);
  const createMutation = useCreateAccountUser();
  const updateProfile = useUpdateAccountUserProfile(userId ?? 0);
  const updateRole = useUpdateAccountUserRole(userId ?? 0);

  const handleCreate = (data: AccountUserCreateValues) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/settings/users', search: {} as never });
      },
    });
  };

  // Role override actually loaded from the detail fetch (F1 makes this present for admins).
  const loadedRoleCode = toAccountRoleCode(userQuery.data?.userAccount?.find((m) => m.accountId === accountId)?.roleOverride?.code);
  // Value the form was seeded with — compare submits against THIS so an untouched form
  // never fires a role write (F5). Falls back to 'editor' only for display when no override.
  const initialRoleCode = loadedRoleCode ?? 'editor';

  const handleEdit = async (data: AccountUserEditValues) => {
    // Two independent endpoints with no transaction. Attempt the riskier, 403-prone
    // role change FIRST: if it fails, profile is never touched and we don't navigate
    // away claiming success (F4). Only write the role when it actually changed vs the
    // seeded value (F5) — avoids silently overwriting a missing override with 'editor'.
    if (data.roleCode !== initialRoleCode) {
      await updateRole.mutateAsync(data.roleCode);
    }
    // Profile (name/email) — skip the call when nothing changed.
    if (data.name !== userQuery.data?.name || data.email !== userQuery.data?.email) {
      await updateProfile.mutateAsync({ name: data.name, email: data.email });
    }
    navigate({ to: '/settings/users', search: {} as never });
  };

  const isPending = createMutation.isPending || updateProfile.isPending || updateRole.isPending;

  if (isEditing && userQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('account.users.editTitle')} backTo="/settings/users" backLabel={t('account.users.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && userQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('account.users.editTitle')} backTo="/settings/users" backLabel={t('account.users.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('account.users.editTitle') : t('account.users.createTitle')}
        backTo="/settings/users"
        backLabel={t('account.users.pageTitle')}
      />
      <FormPage.Content>
        {isEditing && userQuery.data ? (
          <AccountUserForm
            key={userQuery.data.id}
            mode="edit"
            defaultValues={{
              name: userQuery.data.name,
              email: userQuery.data.email,
              roleCode: initialRoleCode,
            }}
            onSubmit={handleEdit}
            isPending={isPending}
          />
        ) : (
          <AccountUserForm mode="create" onSubmit={handleCreate} isPending={isPending} />
        )}
      </FormPage.Content>
    </FormPage.Root>
  );
}
