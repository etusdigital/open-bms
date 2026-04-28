import { createFileRoute } from '@tanstack/react-router';
import { PoolFormPage } from '@/features/pools/pool-form-page';

export const Route = createFileRoute('/_authenticated/_layout/pools/create')({
  component: PoolCreateRoute,
});

function PoolCreateRoute() {
  return <PoolFormPage />;
}
