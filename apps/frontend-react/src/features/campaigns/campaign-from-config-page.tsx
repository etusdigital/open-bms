import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import CampaignForm from './campaign-form';
import { useCreateCampaign } from './use-campaigns';
import { useCampaignConfig } from '@/features/campaign-rules/use-campaign-configs';
import type { CampaignFormValues } from './campaign-schema';

interface CampaignFromConfigPageProps {
  configId: number;
}

export default function CampaignFromConfigPage({ configId }: CampaignFromConfigPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const configQuery = useCampaignConfig(configId);
  const createMutation = useCreateCampaign();

  const handleSubmit = (data: CampaignFormValues) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/campaigns', search: {} as never });
      },
    });
  };

  if (configQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaigns.createFromRule')}
          backTo="/campaign-rules/configs"
          backLabel={t('campaignRules.configsPageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (configQuery.error || !configQuery.data) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaigns.createFromRule')}
          backTo="/campaign-rules/configs"
          backLabel={t('campaignRules.configsPageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  // Unwrap config data into campaign form defaults
  const configData = (configQuery.data.configs ?? {}) as Record<string, unknown>;
  const defaultValues: Partial<CampaignFormValues> = {
    title: '',
    description: configQuery.data.description ?? '',
    ...(configData as Partial<CampaignFormValues>),
    // Content step starts empty — configs don't have messages
    campaignMessage: [],
  };

  return (
    <FormPage.Root>
      <FormPage.Header
        title={t('campaigns.createFromRule')}
        backTo="/campaign-rules/configs"
        backLabel={t('campaignRules.configsPageTitle')}
      />
      <FormPage.Content>
        <CampaignForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: '/campaign-rules/configs', search: {} as never })}
          isPending={createMutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
