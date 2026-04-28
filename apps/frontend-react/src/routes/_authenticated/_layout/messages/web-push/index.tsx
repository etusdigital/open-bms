import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_layout/messages/web-push/')({
  beforeLoad: () => {
    throw redirect({ to: '/messages', search: { type: 'web-push' } as never });
  },
  component: () => null,
});
