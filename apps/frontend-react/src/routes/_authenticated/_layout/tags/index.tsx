import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import TagsPage from '@/features/tags/tags-page';

export const Route = createFileRoute('/_authenticated/_layout/tags/')({
  validateSearch: listSearchSchema,
  component: TagsRoute,
});

function TagsRoute() {
  const searchParams = Route.useSearch();
  return <TagsPage searchParams={searchParams} />;
}
