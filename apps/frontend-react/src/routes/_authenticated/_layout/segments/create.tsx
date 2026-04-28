import { createFileRoute } from '@tanstack/react-router';
import { SegmentFormPage } from '@/features/segments/segment-form-page';

export const Route = createFileRoute('/_authenticated/_layout/segments/create')({
  component: SegmentCreateRoute,
});

function SegmentCreateRoute() {
  return <SegmentFormPage />;
}
