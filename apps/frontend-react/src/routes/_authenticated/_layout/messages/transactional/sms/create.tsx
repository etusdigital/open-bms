import { createFileRoute } from '@tanstack/react-router';
import MessageFormPage from '@/features/messages/message-form-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/transactional/sms/create')({
  component: () => <MessageFormPage messageType="transactional-sms" />,
});
