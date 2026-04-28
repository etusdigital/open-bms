import { createFileRoute } from '@tanstack/react-router';
import { ContactImportPage } from '@/features/contacts/contact-import-page';

export const Route = createFileRoute('/_authenticated/_layout/contacts/import')({
  component: ContactImportRoute,
});

function ContactImportRoute() {
  return <ContactImportPage />;
}
