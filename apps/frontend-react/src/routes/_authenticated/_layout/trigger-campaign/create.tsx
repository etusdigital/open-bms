import { createFileRoute } from '@tanstack/react-router';
import TriggerCampaignFormPage from '@/features/trigger-campaigns/trigger-campaign-form-page';

export const Route = createFileRoute('/_authenticated/_layout/trigger-campaign/create')({
  component: () => <TriggerCampaignFormPage />,
});
