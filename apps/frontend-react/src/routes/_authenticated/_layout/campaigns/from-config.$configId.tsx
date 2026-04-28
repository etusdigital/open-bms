import { createFileRoute } from '@tanstack/react-router';
import CampaignFromConfigPage from '@/features/campaigns/campaign-from-config-page';

export const Route = createFileRoute('/_authenticated/_layout/campaigns/from-config/$configId')({
  component: () => {
    const { configId } = Route.useParams();
    return <CampaignFromConfigPage configId={Number(configId)} />;
  },
});
