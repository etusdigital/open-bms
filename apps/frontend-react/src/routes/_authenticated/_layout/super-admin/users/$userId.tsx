import { createFileRoute } from '@tanstack/react-router';
import { SuperAdminUserFormPage } from '@/features/super-admin/users/user-form-page';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/users/$userId')({
  component: SuperAdminUserEditRoute,
});

function SuperAdminUserEditRoute() {
  const { userId } = Route.useParams();
  return <SuperAdminUserFormPage userId={Number(userId)} />;
}
