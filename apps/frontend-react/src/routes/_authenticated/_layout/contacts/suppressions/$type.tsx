import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import { SuppressionsPage } from '@/features/contacts/suppressions-page';
import type { SuppressionType } from '@/features/contacts/use-suppressions';

export const Route = createFileRoute('/_authenticated/_layout/contacts/suppressions/$type')({
  validateSearch: listSearchSchema,
  component: SuppressionsRoute,
});

function SuppressionsRoute() {
  const { type } = Route.useParams();
  const searchParams = Route.useSearch();
  return <SuppressionsPage type={type as SuppressionType} searchParams={searchParams} />;
}
