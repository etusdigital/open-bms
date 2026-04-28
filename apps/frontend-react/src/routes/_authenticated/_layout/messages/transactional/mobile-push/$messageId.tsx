import { createFileRoute } from '@tanstack/react-router';
import MessageFormPage from '@/features/messages/message-form-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/transactional/mobile-push/$messageId')({
  component: () => {
    const { messageId } = Route.useParams();
    return <MessageFormPage messageId={Number(messageId)} messageType="transactional-mobile-push" />;
  },
});
