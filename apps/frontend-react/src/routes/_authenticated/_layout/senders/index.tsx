import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import SendersPage from '@/features/senders/senders-page';

export const Route = createFileRoute('/_authenticated/_layout/senders/')({
  validateSearch: listSearchSchema,
  component: SendersRoute,
});

function SendersRoute() {
  const searchParams = Route.useSearch();
  return <SendersPage searchParams={searchParams} />;
}
