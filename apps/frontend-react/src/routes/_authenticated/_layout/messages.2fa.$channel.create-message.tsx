import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import MessageFormPage from '@/features/messages/message-form-page';
import type { TwoFAMessageType } from '@/features/messages/types';

const searchSchema = z.object({
  groupName: z.string().optional(),
  isNewGroup: z.boolean().optional(),
});

export const Route = createFileRoute('/_authenticated/_layout/messages/2fa/$channel/create-message')({
  validateSearch: searchSchema,
  component: CreateTwoFAMessagePage,
});

function CreateTwoFAMessagePage() {
  const navigate = useNavigate();
  const { channel } = Route.useParams();
  const { groupName, isNewGroup } = Route.useSearch();

  const messageType = `2FA-${channel}` as TwoFAMessageType;

  const handleSuccess = (messageId: number) => {
    if (groupName && !isNewGroup) {
      navigate({
        to: `/messages/2fa/${channel}/${groupName}` as string,
        search: { newMessageId: messageId },
      });
    } else if (groupName && isNewGroup) {
      navigate({
        to: `/messages/2fa/${channel}/new-group` as string,
        search: { newMessageId: messageId, groupName },
      });
    } else {
      navigate({ to: '/messages/2fa' });
    }
  };

  return <MessageFormPage messageType={messageType} onSuccess={handleSuccess} />;
}
