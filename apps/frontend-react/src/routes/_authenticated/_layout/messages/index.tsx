import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import MessagesPage from '@/features/messages/messages-page';
import type { MessageType } from '@/features/messages/types';

const messageTypes = ['email', 'sms', 'web-push', 'mobile-push', 'whatsapp'] as const;

const messagesSearchSchema = listSearchSchema.extend({
  type: z.enum(messageTypes).optional().default('email'),
  sender: z.string().optional().default(''),
  automationId: z.coerce.number().optional(),
});

export const Route = createFileRoute('/_authenticated/_layout/messages/')({
  validateSearch: messagesSearchSchema,
  component: MessagesIndexPage,
});

function MessagesIndexPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const messageType = (search.type ?? 'email') as MessageType;

  const handleTypeChange = (type: MessageType) => {
    navigate({
      search: (prev) => ({
        ...prev,
        type,
        page: 1,
        search: '',
        sender: '',
        automationId: undefined,
      }),
    });
  };

  const handleSenderChange = (sender: string) => {
    navigate({
      search: (prev) => ({ ...prev, sender, page: 1 }),
    });
  };

  const handleAutomationChange = (automationId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        automationId: automationId ? Number(automationId) : undefined,
        page: 1,
      }),
    });
  };

  return (
    <MessagesPage
      searchParams={search}
      messageType={messageType}
      onTypeChange={handleTypeChange}
      sender={search.sender}
      automationId={search.automationId}
      onSenderChange={handleSenderChange}
      onAutomationChange={handleAutomationChange}
    />
  );
}
