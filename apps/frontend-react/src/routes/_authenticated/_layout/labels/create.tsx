import { createFileRoute } from '@tanstack/react-router';
import { LabelFormPage } from '@/features/labels/label-form-page';

export const Route = createFileRoute('/_authenticated/_layout/labels/create')({
  component: LabelCreateRoute,
});

function LabelCreateRoute() {
  return <LabelFormPage />;
}
