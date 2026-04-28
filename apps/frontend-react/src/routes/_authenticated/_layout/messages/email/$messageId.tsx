import { createFileRoute } from '@tanstack/react-router';
import MessageFormPage from '@/features/messages/message-form-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/email/$messageId')({
  component: () => {
    const { messageId } = Route.useParams();
    return <MessageFormPage messageId={Number(messageId)} messageType="email" />;
  },
});
