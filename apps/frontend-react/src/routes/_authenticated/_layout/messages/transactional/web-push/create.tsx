import { createFileRoute } from '@tanstack/react-router';
import MessageFormPage from '@/features/messages/message-form-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/transactional/web-push/create')({
  component: () => <MessageFormPage messageType="transactional-web-push" />,
});
