import { createFileRoute } from '@tanstack/react-router';
import CampaignFromRulePage from '@/features/campaigns/campaign-from-rule-page';

export const Route = createFileRoute('/_authenticated/_layout/campaigns/from-rule')({
  component: CampaignFromRulePage,
});
