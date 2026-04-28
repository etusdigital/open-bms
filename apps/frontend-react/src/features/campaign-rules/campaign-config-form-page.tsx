import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { CampaignConfigForm } from './campaign-config-form';
import { useCampaignConfig, useCreateCampaignConfig, useUpdateCampaignConfig } from './use-campaign-configs';
import type { CampaignConfigFormValues } from './campaign-rule-schema';

interface CampaignConfigFormPageProps {
  configId?: number;
}

export function CampaignConfigFormPage({ configId }: CampaignConfigFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = configId !== undefined;

  const configQuery = useCampaignConfig(isEditing ? configId : 0);
  const createMutation = useCreateCampaignConfig();
  const updateMutation = useUpdateCampaignConfig(configId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: CampaignConfigFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/campaign-rules/configs', search: {} as never });
      },
    });
  };

  if (isEditing && configQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaignRules.editConfig')}
          backTo="/campaign-rules/configs"
          backLabel={t('campaignRules.configsPageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && configQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaignRules.editConfig')}
          backTo="/campaign-rules/configs"
          backLabel={t('campaignRules.configsPageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && configQuery.data
      ? {
          name: configQuery.data.name,
          description: configQuery.data.description ?? '',
          configs: configQuery.data.configs,
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('campaignRules.editConfig') : t('campaignRules.createConfig')}
        backTo="/campaign-rules/configs"
        backLabel={t('campaignRules.configsPageTitle')}
      />
      <FormPage.Content>
        <CampaignConfigForm
          key={configQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
