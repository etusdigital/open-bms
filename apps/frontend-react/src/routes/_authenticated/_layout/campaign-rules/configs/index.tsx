import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import CampaignConfigsPage from '@/features/campaign-rules/campaign-configs-page';

export const Route = createFileRoute('/_authenticated/_layout/campaign-rules/configs/')({
  validateSearch: listSearchSchema,
  component: CampaignConfigsRoute,
});

function CampaignConfigsRoute() {
  const searchParams = Route.useSearch();
  return <CampaignConfigsPage searchParams={searchParams} />;
}
