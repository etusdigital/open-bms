import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import SuperAdminAccountsPage from '@/features/super-admin/accounts/accounts-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/')({
  validateSearch: listSearchSchema,
  component: SuperAdminAccountsIndexRoute,
});

function SuperAdminAccountsIndexRoute() {
  const searchParams = Route.useSearch();
  return <SuperAdminAccountsPage />;
}
