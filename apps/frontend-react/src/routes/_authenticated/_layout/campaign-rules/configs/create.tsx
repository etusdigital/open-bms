import { createFileRoute } from '@tanstack/react-router';
import { CampaignConfigFormPage } from '@/features/campaign-rules/campaign-config-form-page';

export const Route = createFileRoute('/_authenticated/_layout/campaign-rules/configs/create')({
  component: CampaignConfigCreateRoute,
});

function CampaignConfigCreateRoute() {
  return <CampaignConfigFormPage />;
}
