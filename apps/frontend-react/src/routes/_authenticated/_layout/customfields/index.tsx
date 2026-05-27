import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import CustomFieldsPage from '@/features/custom-fields/custom-fields-page';

export const Route = createFileRoute('/_authenticated/_layout/customfields/')({
  validateSearch: listSearchSchema,
  component: CustomFieldsRoute,
});

function CustomFieldsRoute() {
  const searchParams = Route.useSearch();
  return <CustomFieldsPage searchParams={searchParams} />;
}
