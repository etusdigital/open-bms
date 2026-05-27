import { createFileRoute } from '@tanstack/react-router';
import { PoolFormPage } from '@/features/pools/pool-form-page';

export const Route = createFileRoute('/_authenticated/_layout/pools/$poolId')({
  component: PoolEditRoute,
});

function PoolEditRoute() {
  const { poolId } = Route.useParams();
  return <PoolFormPage poolId={Number(poolId)} />;
}
