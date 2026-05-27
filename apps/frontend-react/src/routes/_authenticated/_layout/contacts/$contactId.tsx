import { createFileRoute } from '@tanstack/react-router';
import { ContactDetailPage } from '@/features/contacts/contact-detail-page';

export const Route = createFileRoute('/_authenticated/_layout/contacts/$contactId')({
  component: ContactDetailRoute,
});

function ContactDetailRoute() {
  const { contactId } = Route.useParams();
  return <ContactDetailPage contactUuid={contactId} />;
}
