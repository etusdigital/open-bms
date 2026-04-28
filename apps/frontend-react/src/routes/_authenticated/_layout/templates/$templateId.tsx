import { createFileRoute } from '@tanstack/react-router';
import { TemplateFormPage } from '@/features/templates/template-form-page';

export const Route = createFileRoute('/_authenticated/_layout/templates/$templateId')({
  component: TemplateEditRoute,
});

function TemplateEditRoute() {
  const { templateId } = Route.useParams();
  return <TemplateFormPage templateId={Number(templateId)} />;
}
