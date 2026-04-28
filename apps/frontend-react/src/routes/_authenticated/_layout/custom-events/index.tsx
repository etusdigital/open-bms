import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import CustomEventsPage from '@/features/custom-events/custom-events-page';

export const Route = createFileRoute('/_authenticated/_layout/custom-events/')({
  validateSearch: listSearchSchema,
  component: CustomEventsRoute,
});

function CustomEventsRoute() {
  const searchParams = Route.useSearch();
  return <CustomEventsPage searchParams={searchParams} />;
}
