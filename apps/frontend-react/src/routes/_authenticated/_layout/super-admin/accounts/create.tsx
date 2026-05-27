import { createFileRoute } from '@tanstack/react-router';
import { SuperAdminAccountFormPage } from '@/features/super-admin/accounts/account-form-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/create')({
  component: SuperAdminAccountCreateRoute,
});

function SuperAdminAccountCreateRoute() {
  return <SuperAdminAccountFormPage />;
}
