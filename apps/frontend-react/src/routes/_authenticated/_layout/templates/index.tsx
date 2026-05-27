import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import TemplatesPage from '@/features/templates/templates-page';

export const Route = createFileRoute('/_authenticated/_layout/templates/')({
  validateSearch: listSearchSchema,
  component: TemplatesRoute,
});

function TemplatesRoute() {
  const searchParams = Route.useSearch();
  return <TemplatesPage searchParams={searchParams} />;
}
