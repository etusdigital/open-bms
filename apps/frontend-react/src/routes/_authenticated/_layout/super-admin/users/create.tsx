import { createFileRoute } from '@tanstack/react-router';
import { SuperAdminUserFormPage } from '@/features/super-admin/users/user-form-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/users/create')({
  component: SuperAdminUserCreateRoute,
});

function SuperAdminUserCreateRoute() {
  return <SuperAdminUserFormPage />;
}
