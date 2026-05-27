import { createFileRoute } from '@tanstack/react-router';
import { ContactDetailPage } from '@/features/contacts/contact-detail-page';

export const Route = createFileRoute('/_authenticated/_layout/contacts/$contactUuid')({
  component: ContactDetailRoute,
});

function ContactDetailRoute() {
  const { contactUuid } = Route.useParams();
  return <ContactDetailPage contactUuid={contactUuid} />;
}
