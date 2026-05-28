import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAppStore } from '@/stores/app-store';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import AccountUsersPage from '@/features/account-users/users-page';

export const Route = createFileRoute('/_authenticated/_layout/settings/users/')({
  beforeLoad: () => {
    const { auth } = useAppStore.getState();
    // Defer when auth hasn't settled (cold load / refresh): the _authenticated parent
    // shows the loading screen and re-runs guards once resolved. Do NOT grant access
    // before auth settles, otherwise the guard fails open on refresh (F3 / AC-8).
    if (auth.status !== 'authenticated') return;
    const canView = auth.effectiveRole === 'super_admin' || auth.permissions.has('account:users_view' as never);
    if (!canView) {
      throw redirect({ to: '/' });
    }
  },
  validateSearch: listSearchSchema,
  component: AccountUsersIndexRoute,
});

function AccountUsersIndexRoute() {
  const searchParams = Route.useSearch();
  return <AccountUsersPage searchParams={searchParams} />;
}
