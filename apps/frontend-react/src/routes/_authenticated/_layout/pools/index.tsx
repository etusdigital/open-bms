import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import PoolsPage from '@/features/pools/pools-page';

export const Route = createFileRoute('/_authenticated/_layout/pools/')({
  validateSearch: listSearchSchema,
  component: PoolsRoute,
});

function PoolsRoute() {
  const searchParams = Route.useSearch();
  return <PoolsPage searchParams={searchParams} />;
}
