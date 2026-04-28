import { createFileRoute } from '@tanstack/react-router';
import { leadsSearchSchema } from '@/features/leads/leads-search-schema';
import LeadsPage from '@/features/leads/leads-page';

export const Route = createFileRoute('/_authenticated/_layout/analytics/leads')({
  validateSearch: leadsSearchSchema,
  component: () => {
    const search = Route.useSearch();
    return <LeadsPage searchParams={search} />;
  },
});
