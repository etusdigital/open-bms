import { createFileRoute } from '@tanstack/react-router';
import TwoFAMessagesPage from '@/features/twofa-messages/twofa-messages-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/2fa/')({
  component: TwoFAMessagesPage,
});
