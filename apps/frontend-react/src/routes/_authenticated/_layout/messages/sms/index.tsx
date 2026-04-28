import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_layout/messages/sms/')({
  beforeLoad: () => {
    throw redirect({ to: '/messages', search: { type: 'sms' } as never });
  },
  component: () => null,
});
