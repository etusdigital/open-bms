import { createFileRoute } from '@tanstack/react-router';
import { WarmupFormPage } from '@/features/warmups/warmup-form-page';

export const Route = createFileRoute('/_authenticated/_layout/warmups/$warmupId/edit')({
  component: WarmupEditRoute,
});

function WarmupEditRoute() {
  const { warmupId } = Route.useParams();
  return <WarmupFormPage warmupId={Number(warmupId)} />;
}
