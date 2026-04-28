import { createFileRoute } from '@tanstack/react-router';
import { CampaignRuleFormPage } from '@/features/campaign-rules/campaign-rule-form-page';

export const Route = createFileRoute('/_authenticated/_layout/campaign-rules/rules/$ruleId')({
  component: CampaignRuleEditRoute,
});

function CampaignRuleEditRoute() {
  const { ruleId } = Route.useParams();
  return <CampaignRuleFormPage ruleId={Number(ruleId)} />;
}
