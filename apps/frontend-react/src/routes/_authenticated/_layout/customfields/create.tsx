import { createFileRoute } from '@tanstack/react-router';
import { CustomFieldFormPage } from '@/features/custom-fields/custom-field-form-page';

export const Route = createFileRoute('/_authenticated/_layout/customfields/create')({
  component: CustomFieldCreateRoute,
});

function CustomFieldCreateRoute() {
  return <CustomFieldFormPage />;
}
