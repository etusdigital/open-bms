import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAppStore } from '@/stores/app-store';
import { AccountUserFormPage } from '@/features/account-users/user-form-page';

export const Route = createFileRoute('/_authenticated/_layout/settings/users/create')({
  beforeLoad: () => {
    const { auth } = useAppStore.getState();
    // Defer until auth settles (F3 / AC-8) — never grant before resolution.
    if (auth.status !== 'authenticated') return;
    const canInvite = auth.effectiveRole === 'super_admin' || auth.permissions.has('account:users_invite' as never);
    if (!canInvite) {
      throw redirect({ to: '/settings/users', search: {} as never });
    }
  },
  component: AccountUserCreateRoute,
});

function AccountUserCreateRoute() {
  return <AccountUserFormPage />;
}
