import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Mail, MousePointerClick, Eye, UserX, ArrowDownUp, ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { FormPage } from '@/components/form-page';
import { useCampaignDashboardStats } from '@/features/campaigns/use-campaigns';
import { formatRate } from '@/features/campaigns/types';
import type { CampaignMessageType } from '@/features/campaigns/types';
import TriggerCampaignForm from './trigger-campaign-form';
import { useTriggerCampaign, useCreateTriggerCampaign, useUpdateTriggerCampaign } from './use-trigger-campaigns';
import type { TriggerCampaignFormValues } from './trigger-campaign-schema';
import { buildTriggerPayload } from './build-trigger-payload';
import { parseTriggerSteps } from './parse-trigger-steps';

interface TriggerCampaignFormPageProps {
  campaignId?: number;
}

export default function TriggerCampaignFormPage({ campaignId }: TriggerCampaignFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = campaignId !== undefined;

  const campaignQuery = useTriggerCampaign(isEditing ? campaignId : 0);
  const createMutation = useCreateTriggerCampaign();
  const updateMutation = useUpdateTriggerCampaign(campaignId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const dashboardStats = useCampaignDashboardStats(
    isEditing ? campaignId! : 0,
    (campaignQuery.data?.messageType ?? 'email') as CampaignMessageType,
    campaignQuery.data?.createdAt,
  );
  const general = dashboardStats.data;

  const handleSubmit = (data: TriggerCampaignFormValues, conditional: unknown[]) => {
    const payload = buildTriggerPayload(data, conditional);
    mutation.mutate(payload as any, {
      onSuccess: () => {
        navigate({ to: '/trigger-campaign', search: {} as never });
      },
    });
  };

  if (isEditing && campaignQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('triggerCampaigns.edit')}
          backTo="/trigger-campaign"
          backLabel={t('triggerCampaigns.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && (campaignQuery.isError || !campaignQuery.data)) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('triggerCampaigns.edit')}
          backTo="/trigger-campaign"
          backLabel={t('triggerCampaigns.pageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && campaignQuery.data
      ? {
          title: campaignQuery.data.title,
          description: campaignQuery.data.description ?? '',
          messageType: campaignQuery.data.messageType,
          ...parseTriggerSteps(campaignQuery.data.steps),
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('triggerCampaigns.edit') : t('triggerCampaigns.createCampaign')}
        backTo="/trigger-campaign"
        backLabel={t('triggerCampaigns.pageTitle')}
      />
      <FormPage.Content>
        {isEditing && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <Mail className="h-3.5 w-3.5" />
                    {t('triggerCampaigns.statsDelivered')}
                  </div>
                  <p className="text-xl font-bold">{general?.delivered?.toLocaleString() ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    {t('triggerCampaigns.statsOpen')}
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    {general?.open?.toLocaleString() ?? 0}{' '}
                    <span className="text-sm">{formatRate(general?.open ?? 0, general?.delivered ?? 0)}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <MousePointerClick className="h-3.5 w-3.5" />
                    {t('triggerCampaigns.statsClick')}
                  </div>
                  <p className="text-xl font-bold text-blue-600">
                    {general?.click?.toLocaleString() ?? 0}{' '}
                    <span className="text-sm">{formatRate(general?.click ?? 0, general?.delivered ?? 0)}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <UserX className="h-3.5 w-3.5" />
                    {t('triggerCampaigns.statsUnsubscribe')}
                  </div>
                  <p className="text-xl font-bold text-red-600">
                    {general?.unsubscribe?.toLocaleString() ?? 0}{' '}
                    <span className="text-sm">{formatRate(general?.unsubscribe ?? 0, general?.delivered ?? 0)}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {t('triggerCampaigns.statsBounce')}
                  </div>
                  <p className="text-xl font-bold">
                    {general?.bounce?.toLocaleString() ?? 0}{' '}
                    <span className="text-sm">{formatRate(general?.bounce ?? 0, general?.delivered ?? 0)}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <ShieldX className="h-3.5 w-3.5" />
                    {t('triggerCampaigns.statsBlocked')}
                  </div>
                  <p className="text-xl font-bold">
                    {general?.blocked?.toLocaleString() ?? 0}{' '}
                    <span className="text-sm">{formatRate(general?.blocked ?? 0, general?.delivered ?? 0)}</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
        <TriggerCampaignForm
          key={campaignQuery.data?.id}
          campaignId={campaignId}
          defaultValues={defaultValues}
          initialConditional={isEditing ? ((campaignQuery.data?.steps as any)?.settings?.conditional ?? []) : undefined}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
