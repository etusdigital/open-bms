import { createFileRoute } from '@tanstack/react-router';
import CampaignFormPage from '@/features/campaigns/campaign-form-page';

export const Route = createFileRoute('/_authenticated/_layout/campaigns/create')({
  component: () => <CampaignFormPage />,
});
