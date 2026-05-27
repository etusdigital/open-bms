import { createFileRoute } from '@tanstack/react-router';
import MessageFormPage from '@/features/messages/message-form-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/mobile-push/create')({
  component: () => <MessageFormPage messageType="mobile-push" />,
});
