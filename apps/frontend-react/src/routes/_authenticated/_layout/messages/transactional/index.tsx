import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import TransactionalMessagesPage from '@/features/messages/transactional-messages-page';

export const Route = createFileRoute('/_authenticated/_layout/messages/transactional/')({
  validateSearch: listSearchSchema,
  component: TransactionalIndexPage,
});

function TransactionalIndexPage() {
  const search = Route.useSearch();
  return <TransactionalMessagesPage searchParams={search} />;
}
