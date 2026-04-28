import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import TriggerCampaignsPage from '@/features/trigger-campaigns/trigger-campaigns-page';

export const Route = createFileRoute('/_authenticated/_layout/trigger-campaign/')({
  validateSearch: listSearchSchema,
  component: () => {
    const search = Route.useSearch();
    return <TriggerCampaignsPage searchParams={search} />;
  },
});
