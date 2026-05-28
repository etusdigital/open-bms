import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAppStore } from '@/stores/app-store';
import { AccountUserFormPage } from '@/features/account-users/user-form-page';

export const Route = createFileRoute('/_authenticated/_layout/settings/users/$userId')({
  beforeLoad: ({ params }) => {
    const { auth } = useAppStore.getState();
    // Defer until auth settles (F3 / AC-8) — never grant before resolution.
    if (auth.status !== 'authenticated') return;
    const canManage = auth.effectiveRole === 'super_admin' || auth.permissions.has('account:users_update_roles' as never);
    if (!canManage) {
      throw redirect({ to: '/settings/users', search: {} as never });
    }
    // Editing yourself is blocked (anti-self-modify). Super admins are exempt.
    if (auth.effectiveRole !== 'super_admin' && String(auth.user.id) === params.userId) {
      throw redirect({ to: '/settings/users', search: {} as never });
    }
  },
  component: AccountUserEditRoute,
});

function AccountUserEditRoute() {
  const { userId } = Route.useParams();
  return <AccountUserFormPage userId={Number(userId)} />;
}
