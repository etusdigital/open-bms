import { createFileRoute } from '@tanstack/react-router';
import { SegmentFormPage } from '@/features/segments/segment-form-page';

export const Route = createFileRoute('/_authenticated/_layout/segments/$segmentId')({
  component: SegmentEditRoute,
});

function SegmentEditRoute() {
  const { segmentId } = Route.useParams();
  return <SegmentFormPage segmentId={Number(segmentId)} />;
}
