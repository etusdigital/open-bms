import { createFileRoute } from '@tanstack/react-router';
import { SuperAdminAccountFormPage } from '@/features/super-admin/accounts/account-form-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/$accountId')({
  component: SuperAdminAccountEditRoute,
});

function SuperAdminAccountEditRoute() {
  const { accountId } = Route.useParams();
  return <SuperAdminAccountFormPage accountId={Number(accountId)} />;
}
