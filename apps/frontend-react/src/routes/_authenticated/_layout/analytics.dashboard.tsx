import { createFileRoute } from '@tanstack/react-router';
import { statisticsSearchSchema } from '@/features/email-statistics/statistics-search-schema';
import EmailStatisticsPage from '@/features/email-statistics/email-statistics-page';

export const Route = createFileRoute('/_authenticated/_layout/analytics/dashboard')({
  validateSearch: statisticsSearchSchema,
  component: AnalyticsDashboardRoute,
});

function AnalyticsDashboardRoute() {
  const searchParams = Route.useSearch();
  return <EmailStatisticsPage searchParams={searchParams} />;
}
