import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import LabelsPage from '@/features/labels/labels-page';

export const Route = createFileRoute('/_authenticated/_layout/labels/')({
  validateSearch: listSearchSchema,
  component: LabelsRoute,
});

function LabelsRoute() {
  const searchParams = Route.useSearch();
  return <LabelsPage searchParams={searchParams} />;
}
