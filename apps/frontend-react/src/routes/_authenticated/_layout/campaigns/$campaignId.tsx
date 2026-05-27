import { createFileRoute } from '@tanstack/react-router';
import CampaignFormPage from '@/features/campaigns/campaign-form-page';

export const Route = createFileRoute('/_authenticated/_layout/campaigns/$campaignId')({
  component: () => {
    const { campaignId } = Route.useParams();
    return <CampaignFormPage campaignId={Number(campaignId)} />;
  },
});
