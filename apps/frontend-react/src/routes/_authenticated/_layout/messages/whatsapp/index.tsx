import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_layout/messages/whatsapp/')({
  beforeLoad: () => {
    throw redirect({ to: '/messages', search: { type: 'whatsapp' } as never });
  },
  component: () => null,
});
