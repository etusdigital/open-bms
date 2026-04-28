import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import InsightsPage from '@/features/insights/insights-page';

const insightsSearchSchema = z.object({
  period: z.enum(['last48', 'last7']).default('last48').catch('last48'),
});

export const Route = createFileRoute('/_authenticated/_layout/analytics/insights')({
  validateSearch: insightsSearchSchema,
  component: InsightsRoute,
});

function InsightsRoute() {
  const searchParams = Route.useSearch();
  return <InsightsPage period={searchParams.period} />;
}
