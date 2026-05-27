import { createFileRoute } from '@tanstack/react-router';
import { LabelFormPage } from '@/features/labels/label-form-page';

export const Route = createFileRoute('/_authenticated/_layout/labels/$labelId')({
  component: LabelEditRoute,
});

function LabelEditRoute() {
  const { labelId } = Route.useParams();
  return <LabelFormPage labelId={Number(labelId)} />;
}
