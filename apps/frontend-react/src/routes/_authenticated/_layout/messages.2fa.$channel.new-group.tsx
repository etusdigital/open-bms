import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import TwoFAGroupFormPage from '@/features/twofa-messages/twofa-group-form-page';
import type { TwoFAChannel } from '@/features/twofa-messages/types';

const searchSchema = z.object({
  newMessageId: z.number().optional(),
  groupName: z.string().optional(),
});

export const Route = createFileRoute('/_authenticated/_layout/messages/2fa/$channel/new-group')({
  validateSearch: searchSchema,
  component: NewGroupPage,
});

function NewGroupPage() {
  const { channel } = Route.useParams();
  const { newMessageId, groupName } = Route.useSearch();
  return (
    <TwoFAGroupFormPage channel={channel as TwoFAChannel} initialGroupName={groupName} newMessageId={newMessageId} />
  );
}
