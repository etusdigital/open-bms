import { createFileRoute } from '@tanstack/react-router';
import { CampaignRuleFormPage } from '@/features/campaign-rules/campaign-rule-form-page';

export const Route = createFileRoute('/_authenticated/_layout/campaign-rules/rules/create')({
  component: CampaignRuleCreateRoute,
});

function CampaignRuleCreateRoute() {
  return <CampaignRuleFormPage />;
}
