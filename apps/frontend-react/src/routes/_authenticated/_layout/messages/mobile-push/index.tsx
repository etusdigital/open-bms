import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_layout/messages/mobile-push/')({
  beforeLoad: () => {
    throw redirect({ to: '/messages', search: { type: 'mobile-push' } as never });
  },
  component: () => null,
});
