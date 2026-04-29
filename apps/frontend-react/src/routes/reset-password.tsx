import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ResetPasswordConfirmPage } from '@/features/super-admin/reset-password/reset-password-confirm-page';

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string() }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { token } = Route.useSearch();
  return <ResetPasswordConfirmPage token={token} />;
}
