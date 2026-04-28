import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import MessageFormPage from '@/features/messages/message-form-page';
import type { TwoFAMessageType } from '@/features/messages/types';

const searchSchema = z.object({
  groupName: z.string().optional(),
  isNewGroup: z.boolean().optional(),
});

export const Route = createFileRoute('/_authenticated/_layout/messages/2fa/$channel/edit/$messageId')({
  validateSearch: searchSchema,
  component: EditTwoFAMessagePage,
});

function EditTwoFAMessagePage() {
  const navigate = useNavigate();
  const { channel, messageId } = Route.useParams();
  const { groupName, isNewGroup } = Route.useSearch();

  const messageType = `2FA-${channel}` as TwoFAMessageType;

  const handleSuccess = () => {
    if (groupName && !isNewGroup) {
      navigate({ to: `/messages/2fa/${channel}/${groupName}` as string });
    } else if (groupName && isNewGroup) {
      navigate({ to: `/messages/2fa/${channel}/new-group` as string, search: { groupName } });
    } else {
      navigate({ to: '/messages/2fa' });
    }
  };

  return <MessageFormPage messageId={Number(messageId)} messageType={messageType} onSuccess={handleSuccess} />;
}
