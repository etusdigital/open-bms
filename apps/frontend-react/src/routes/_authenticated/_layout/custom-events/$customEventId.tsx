import { createFileRoute } from '@tanstack/react-router';
import { CustomEventFormPage } from '@/features/custom-events/custom-event-form-page';

export const Route = createFileRoute('/_authenticated/_layout/custom-events/$customEventId')({
  component: CustomEventEditRoute,
});

function CustomEventEditRoute() {
  const { customEventId } = Route.useParams();
  return <CustomEventFormPage customEventId={Number(customEventId)} />;
}
