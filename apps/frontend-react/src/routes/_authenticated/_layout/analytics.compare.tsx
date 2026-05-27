import { createFileRoute } from '@tanstack/react-router';
import { comparisonSearchSchema } from '@/features/email-comparison/comparison-search-schema';
import EmailComparisonPage from '@/features/email-comparison/email-comparison-page';

export const Route = createFileRoute('/_authenticated/_layout/analytics/compare')({
  validateSearch: comparisonSearchSchema,
  component: CompareRoute,
});

function CompareRoute() {
  const searchParams = Route.useSearch();
  return <EmailComparisonPage searchParams={searchParams} />;
}
