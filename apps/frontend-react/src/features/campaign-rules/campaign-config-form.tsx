import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import StepIndicator from '@/features/campaigns/steps/step-indicator';
import SettingsStep from '@/features/campaigns/steps/settings-step';
import AudienceStep from '@/features/campaigns/steps/audience-step';
import ScheduleStep from '@/features/campaigns/steps/schedule-step';
import RecurringStep from '@/features/campaigns/steps/recurring-step';
import ReviewStep from '@/features/campaigns/steps/review-step';
import { campaignFormSchema, type CampaignFormValues } from '@/features/campaigns/campaign-schema';
import { type CampaignConfigFormValues } from './campaign-rule-schema';
import { useState } from 'react';

interface CampaignConfigFormProps {
  defaultValues?: CampaignConfigFormValues;
  onSubmit: (data: CampaignConfigFormValues) => void;
  isPending: boolean;
}

export function CampaignConfigForm({ defaultValues, onSubmit, isPending }: CampaignConfigFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;
  const [currentStep, setCurrentStep] = useState(0);

  const STEPS = [
    { label: t('campaigns.stepSettings') },
    { label: t('campaigns.stepAudience') },
    { label: t('campaigns.stepSchedule') },
    { label: t('campaigns.stepReview') },
  ];

  // Parse configs from defaultValues into campaign form defaults
  const configData = defaultValues?.configs as Record<string, unknown> | undefined;
  const campaignDefaults: Partial<CampaignFormValues> = configData ? (configData as Partial<CampaignFormValues>) : {};

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema) as never,
    defaultValues: {
      title: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      type: 'simple',
      messageType: 'email',
      sendToAll: false,
      sendAfterCreate: false,
      runSegment: false,
      isRateLimit: true,
      scheduleTo: '',
      spreadSending: 60,
      steps: [],
      campaignMessage: [],
      labels: [],
      labelContent: [],
      recurrenceSettings: {
        date: '',
        interval: 1,
        frequency: null,
        weekDays: [],
        hasExpiration: false,
        untilDate: null,
        untilSend: null,
      },
      testabScheduleTo: '',
      testabScheduleEnd: '',
      testabAudiencePercent: 10,
      testabCriteria: 'open',
      testabSentAfterTest: true,
      confirmSaveDuplicate: false,
      ...campaignDefaults,
    },
  });

  const campaignType = form.watch('type');
  const isLastStep = currentStep === STEPS.length - 1;

  const handleNext = async () => {
    if (currentStep === 0) {
      const valid = await form.trigger(['title', 'description', 'type', 'messageType']);
      if (!valid) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFormSubmit = (data: CampaignFormValues) => {
    // Wrap campaign data into config format
    // Vue2 includes title, description and status inside configs too
    const configs = {
      ...data,
      status: 1, // CampaignStatus.Scheduled
      scheduleTo: data.scheduleTo || '00:00',
      testabScheduleTo: data.testabScheduleTo || '00:00',
      testabScheduleEnd: data.testabScheduleEnd || '00:00',
    };
    onSubmit({
      name: data.title,
      description: data.description ?? '',
      configs: configs as unknown as Record<string, unknown>,
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <SettingsStep form={form} isCampaignRule isInternal={false} />;
      case 1:
        return <AudienceStep form={form} isCampaignRule />;
      case 2:
        return campaignType === 'recurring' ? (
          <RecurringStep form={form} isCampaignRule />
        ) : (
          <ScheduleStep form={form} isCampaignRule />
        );
      case 3:
        return <ReviewStep form={form} isCampaignRule />;
      default:
        return null;
    }
  };

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <StepIndicator steps={STEPS} currentStep={currentStep} />

          <Card>
            <CardContent className="pt-6">{renderStep()}</CardContent>
          </Card>

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
              {t('campaigns.previous')}
            </Button>

            <div className="flex gap-2">
              {isLastStep ? (
                <Button type="button" disabled={isPending} onClick={() => void form.handleSubmit(handleFormSubmit)()}>
                  {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext}>
                  {t('campaigns.next')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
