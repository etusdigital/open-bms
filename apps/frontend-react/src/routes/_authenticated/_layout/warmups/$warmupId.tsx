import { createFileRoute } from '@tanstack/react-router';
import { WarmupStatsPage } from '@/features/warmups/warmup-stats-page';

export const Route = createFileRoute('/_authenticated/_layout/warmups/$warmupId')({
  component: WarmupStatsRoute,
});

function WarmupStatsRoute() {
  const { warmupId } = Route.useParams();
  return <WarmupStatsPage warmupId={Number(warmupId)} />;
}
