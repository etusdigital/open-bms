import { createFileRoute } from '@tanstack/react-router';
import { SenderFormPage } from '@/features/senders/sender-form-page';

export const Route = createFileRoute('/_authenticated/_layout/senders/$senderId')({
  component: SenderEditRoute,
});

function SenderEditRoute() {
  const { senderId } = Route.useParams();
  return <SenderFormPage senderId={Number(senderId)} />;
}
