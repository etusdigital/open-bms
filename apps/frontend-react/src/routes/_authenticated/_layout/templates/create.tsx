import { createFileRoute } from '@tanstack/react-router';
import { TemplateFormPage } from '@/features/templates/template-form-page';

export const Route = createFileRoute('/_authenticated/_layout/templates/create')({
  component: TemplateCreateRoute,
});

function TemplateCreateRoute() {
  return <TemplateFormPage />;
}
