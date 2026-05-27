import { createFileRoute } from '@tanstack/react-router';
import { CustomFieldFormPage } from '@/features/custom-fields/custom-field-form-page';

export const Route = createFileRoute('/_authenticated/_layout/customfields/$customFieldId')({
  component: CustomFieldEditRoute,
});

function CustomFieldEditRoute() {
  const { customFieldId } = Route.useParams();
  return <CustomFieldFormPage customFieldId={Number(customFieldId)} />;
}
