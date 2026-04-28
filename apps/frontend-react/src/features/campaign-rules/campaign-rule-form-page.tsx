import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { CampaignRuleForm } from './campaign-rule-form';
import { useCampaignRule, useCreateCampaignRule, useUpdateCampaignRule } from './use-campaign-rules';
import type { CampaignRuleFormValues } from './campaign-rule-schema';

interface CampaignRuleFormPageProps {
  ruleId?: number;
}

export function CampaignRuleFormPage({ ruleId }: CampaignRuleFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = ruleId !== undefined;

  const ruleQuery = useCampaignRule(isEditing ? ruleId : 0);
  const createMutation = useCreateCampaignRule();
  const updateMutation = useUpdateCampaignRule(ruleId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: CampaignRuleFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/campaign-rules', search: {} as never });
      },
    });
  };

  if (isEditing && ruleQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaignRules.editRule')}
          backTo="/campaign-rules"
          backLabel={t('campaignRules.rulesPageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && ruleQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaignRules.editRule')}
          backTo="/campaign-rules"
          backLabel={t('campaignRules.rulesPageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  // Extract configs — API may return configs[] or campaignsRulesConfigs[].campaignConfig
  const extractConfigs = (data: any): { id: number; name: string }[] => {
    if (data.configs && data.configs.length > 0 && data.configs[0]?.id) {
      return data.configs.map((c: any) => ({ id: c.id, name: c.name }));
    }
    if (data.campaignsRulesConfigs) {
      return data.campaignsRulesConfigs.map((rc: any) => ({
        id: rc.campaignConfig?.id ?? rc.id,
        name: rc.campaignConfig?.name ?? rc.name ?? '',
      }));
    }
    return [];
  };

  const defaultValues =
    isEditing && ruleQuery.data
      ? {
          name: ruleQuery.data.name,
          description: ruleQuery.data.description ?? '',
          weekDays: ruleQuery.data.weekDays ?? [],
          configs: extractConfigs(ruleQuery.data),
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('campaignRules.editRule') : t('campaignRules.createRule')}
        backTo="/campaign-rules"
        backLabel={t('campaignRules.rulesPageTitle')}
      />
      <FormPage.Content>
        <CampaignRuleForm
          key={ruleQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
