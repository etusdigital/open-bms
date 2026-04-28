import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import TwoFAGroupFormPage from '@/features/twofa-messages/twofa-group-form-page';
import type { TwoFAChannel } from '@/features/twofa-messages/types';

const searchSchema = z.object({
  newMessageId: z.number().optional(),
});

export const Route = createFileRoute('/_authenticated/_layout/messages/2fa/$channel/$groupName')({
  validateSearch: searchSchema,
  component: EditGroupPage,
});

function EditGroupPage() {
  const { channel, groupName } = Route.useParams();
  const { newMessageId } = Route.useSearch();
  return (
    <TwoFAGroupFormPage
      channel={channel as TwoFAChannel}
      groupName={decodeURIComponent(groupName)}
      newMessageId={newMessageId}
    />
  );
}
