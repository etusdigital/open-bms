import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_layout/messages/2fa')({
  component: () => <Outlet />,
});
