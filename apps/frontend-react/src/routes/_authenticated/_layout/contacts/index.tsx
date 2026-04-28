import { createFileRoute } from '@tanstack/react-router';
import { contactsSearchSchema } from '@/features/contacts/contacts-search-schema';
import ContactsPage from '@/features/contacts/contacts-page';

export const Route = createFileRoute('/_authenticated/_layout/contacts/')({
  validateSearch: contactsSearchSchema,
  component: ContactsRoute,
});

function ContactsRoute() {
  const searchParams = Route.useSearch();
  return <ContactsPage searchParams={searchParams} />;
}
