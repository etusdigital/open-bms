import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { FormPage } from '@/components/form-page';
import { useAppStore, selectIsSuperAdmin } from '@/stores/app-store';
import CampaignForm from './campaign-form';
import ProcessCampaign from './process-campaign';
import { useCampaign, useCreateCampaign, useUpdateCampaign } from './use-campaigns';
import { CampaignStatus, type Campaign } from './types';
import type { CampaignFormValues } from './campaign-schema';

interface CampaignFormPageProps {
  campaignId?: number;
}

export default function CampaignFormPage({ campaignId }: CampaignFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAppStore((s) => s.auth);
  const isInternal = auth.status === 'authenticated' ? auth.account.isInternal : false;
  const isSuperAdmin = useAppStore(selectIsSuperAdmin);
  const isEditing = campaignId !== undefined;

  const campaignQuery = useCampaign(isEditing ? campaignId : 0);
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign(campaignId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: CampaignFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/campaigns', search: {} as never });
      },
      onError: (error: any) => {
        if (error?.response?.status === 409) {
          toast.error(t('campaigns.conflictTitle'));
        }
      },
    });
  };

  if (isEditing && campaignQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('campaigns.edit')} backTo="/campaigns" backLabel={t('campaigns.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && campaignQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('campaigns.edit')} backTo="/campaigns" backLabel={t('campaigns.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  // Show ProcessCampaign for campaigns already being sent or completed
  const isProcessView = isEditing && campaignQuery.data && campaignQuery.data.status > CampaignStatus.Scheduled;

  if (isProcessView && campaignQuery.data) {
    return (
      <FormPage.Root>
        <FormPage.Header title={campaignQuery.data.title} backTo="/campaigns" backLabel={t('campaigns.pageTitle')} />
        <FormPage.Content>
          <ProcessCampaign campaign={campaignQuery.data} />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  // Extract labels from labelContent when labels array is empty
  // The API returns labelContent with nested label objects on GET,
  // but expects flat labels array on POST/PUT
  const extractLabels = (data: Campaign): { id: number; name: string }[] => {
    if (data.labels && data.labels.length > 0) return data.labels;
    if (!data.labelContent || data.labelContent.length === 0) return [];
    return data.labelContent.map((lc: any) => {
      if (lc.label) return { id: lc.label.id, name: lc.label.name };
      return { id: lc.id, name: lc.name };
    });
  };

  const defaultValues =
    isEditing && campaignQuery.data
      ? ({
          title: campaignQuery.data.title,
          name: campaignQuery.data.name ?? '',
          description: campaignQuery.data.description ?? '',
          type: campaignQuery.data.type,
          messageType: campaignQuery.data.messageType,
          sendToAll: campaignQuery.data.sendToAll,
          sendAfterCreate: campaignQuery.data.sendAfterCreate ?? false,
          runSegment: campaignQuery.data.runSegment ?? false,
          isRateLimit: campaignQuery.data.isRateLimit ?? true,
          scheduleTo: campaignQuery.data.scheduleTo ?? '',
          spreadSending: campaignQuery.data.spreadSending ?? 60,
          steps: campaignQuery.data.steps ?? [],
          campaignMessage: (campaignQuery.data.campaignMessage ?? []).map((item: any) => ({
            ...(item.message ?? item),
            statistics: item.statistics,
          })),
          labels: extractLabels(campaignQuery.data),
          labelContent: campaignQuery.data.labelContent ?? [],
          recurrenceSettings: campaignQuery.data.recurrenceSettings ?? undefined,
          testabScheduleTo: campaignQuery.data.testabScheduleTo ?? '',
          testabScheduleEnd: campaignQuery.data.testabScheduleEnd ?? '',
          testabAudiencePercent: campaignQuery.data.testabAudiencePercent ?? 10,
          testabCriteria: campaignQuery.data.testabCriteria ?? 'open',
          testabSentAfterTest: campaignQuery.data.testabSentAfterTest ?? true,
          confirmSaveDuplicate: campaignQuery.data.confirmSaveDuplicate ?? false,
          status: campaignQuery.data.status,
        } as any)
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('campaigns.edit') : t('campaigns.createCampaign')}
        backTo="/campaigns"
        backLabel={t('campaigns.pageTitle')}
      />
      <FormPage.Content>
        <CampaignForm
          key={campaignQuery.data?.id}
          defaultValues={defaultValues}
          campaignId={campaignId}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: '/campaigns', search: {} as never })}
          isPending={mutation.isPending}
          isInternal={isInternal}
          isSuperAdmin={isSuperAdmin}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
