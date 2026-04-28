import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import CampaignRulesPage from '@/features/campaign-rules/campaign-rules-page';

export const Route = createFileRoute('/_authenticated/_layout/campaign-rules/')({
  validateSearch: listSearchSchema,
  component: CampaignRulesRoute,
});

function CampaignRulesRoute() {
  const searchParams = Route.useSearch();
  return <CampaignRulesPage searchParams={searchParams} />;
}
