import { createFileRoute } from '@tanstack/react-router';
import { CampaignConfigFormPage } from '@/features/campaign-rules/campaign-config-form-page';

export const Route = createFileRoute('/_authenticated/_layout/campaign-rules/configs/$configId')({
  component: CampaignConfigEditRoute,
});

function CampaignConfigEditRoute() {
  const { configId } = Route.useParams();
  return <CampaignConfigFormPage configId={Number(configId)} />;
}
