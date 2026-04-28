import { createFileRoute } from '@tanstack/react-router';
import { warmupSearchSchema } from '@/features/warmups/warmups-page';
import WarmupsPage from '@/features/warmups/warmups-page';

export const Route = createFileRoute('/_authenticated/_layout/warmups/')({
  validateSearch: warmupSearchSchema,
  component: WarmupsRoute,
});

function WarmupsRoute() {
  const searchParams = Route.useSearch();
  return <WarmupsPage searchParams={searchParams} />;
}
