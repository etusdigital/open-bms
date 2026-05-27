import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import SuperAdminUsersPage from '@/features/super-admin/users/users-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/users/')({
  validateSearch: listSearchSchema,
  component: SuperAdminUsersIndexRoute,
});

function SuperAdminUsersIndexRoute() {
  const searchParams = Route.useSearch();
  return <SuperAdminUsersPage searchParams={searchParams} />;
}
