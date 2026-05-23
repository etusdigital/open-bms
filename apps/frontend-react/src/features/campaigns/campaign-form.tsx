import { useState, useEffect, useRef } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StepIndicator from './steps/step-indicator';
import SettingsStep from './steps/settings-step';
import AudienceStep from './steps/audience-step';
import ContentStep from './steps/content-step';
import ScheduleStep from './steps/schedule-step';
import RecurringStep from './steps/recurring-step';
import ReviewStep from './steps/review-step';
import { campaignFormSchema, type CampaignFormValues } from './campaign-schema';
import { CampaignStatus, MESSAGE_TYPE_CHANNEL_KEY, firstActiveChannel } from './types';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, selectAccountChannels } from '@/stores/app-store';

interface CampaignFormProps {
  defaultValues?: Partial<CampaignFormValues>;
  campaignId?: number;
  onSubmit: (data: CampaignFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  isCampaignRule?: boolean;
  isInternal?: boolean;
  isSuperAdmin?: boolean;
}

export default function CampaignForm({
  defaultValues,
  campaignId,
  onSubmit,
  onCancel,
  isPending,
  isCampaignRule = false,
  isInternal = false,
  isSuperAdmin = false,
}: CampaignFormProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const accountChannels = useAppStore(useShallow(selectAccountChannels));
  const isEditing = defaultValues !== undefined;
  const defaultStatus = (defaultValues as any)?.status as number | undefined;
  const isEditingDraft = isEditing && defaultStatus === CampaignStatus.Draft;

  const stepsConfig = isCampaignRule
    ? [
        { label: t('campaigns.stepSettings') },
        { label: t('campaigns.stepAudience') },
        { label: t('campaigns.stepSchedule') },
        { label: t('campaigns.stepReview') },
      ]
    : [
        { label: t('campaigns.stepSettings') },
        { label: t('campaigns.stepAudience') },
        { label: t('campaigns.stepContent') },
        { label: t('campaigns.stepSchedule') },
        { label: t('campaigns.stepReview') },
      ];

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema) as never,
    defaultValues: {
      title: '',
      name: '',
      description: '',
      type: 'simple',
      // Default to a channel actually enabled for the account — never a disabled
      // 'email'. An explicit defaultValues.messageType (edit mode) overrides this.
      messageType: firstActiveChannel(accountChannels),
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
      ...defaultValues,
    },
  });

  const campaignType = form.watch('type');
  const messageType = form.watch('messageType');
  const campaignMessages = form.watch('campaignMessage') ?? [];
  const validMessageCount = campaignMessages.filter((m) => m.id || m.messageId).length;
  const disableSimple = validMessageCount > 1;
  const isLastStep = currentStep === stepsConfig.length - 1;

  // Reset type to 'simple' when messageType changes away from email
  // and TestAB/Split was selected
  useEffect(() => {
    if (messageType !== 'email' && (campaignType === 'testAB' || campaignType === 'split')) {
      form.setValue('type', 'simple');
    }
  }, [messageType, campaignType, form]);

  // Clear messages and adjust fields when channel (messageType) changes
  // Mirrors Vue2 @Watch('newCampaign.messageType')
  const prevMessageType = useRef(messageType);
  useEffect(() => {
    if (prevMessageType.current !== messageType) {
      form.setValue('campaignMessage', [{}]);
      if (messageType === 'web-push') {
        form.setValue('spreadSending', 0);
      }
    }
    prevMessageType.current = messageType;
  }, [messageType, form]);

  // Initialize TestAB/Split fields when type changes — mirrors Vue2 @Watch('newCampaign.type')
  const prevCampaignType = useRef(campaignType);
  useEffect(() => {
    if (prevCampaignType.current !== campaignType) {
      const now = new Date().toISOString();
      if (campaignType === 'testAB' || campaignType === 'split') {
        form.setValue('testabScheduleTo', now);
        form.setValue('scheduleTo', now);
        form.setValue('testabSentAfterTest', true);
        form.setValue('testabAudiencePercent', 10);
        form.setValue('testabCriteria', 'open');
      }
      if (campaignType === 'simple') {
        form.setValue('testabScheduleTo', now);
        form.setValue('scheduleTo', now);
      }
    }
    prevCampaignType.current = campaignType;
  }, [campaignType, form]);

  // Re-sync the default channel if account channels resolve after the first
  // render — react-hook-form reads defaultValues only once. Create mode only;
  // edit mode always carries an explicit messageType from defaultValues.
  useEffect(() => {
    if (isEditing || messageType) return;
    const active = firstActiveChannel(accountChannels);
    if (active) form.setValue('messageType', active);
  }, [accountChannels, messageType, isEditing, form]);

  // Channel gating (EVO-1410): creating a campaign requires an active channel,
  // so step 0's nav buttons are disabled until one is selected. Editing an
  // existing campaign is always allowed — the picker disables inactive channels
  // so the user can never switch to one, and a legacy campaign whose channel
  // was since disabled must stay editable.
  const selectedChannelActive = !!messageType && !!accountChannels[MESSAGE_TYPE_CHANNEL_KEY[messageType]];
  const blockSettingsStep = currentStep === 0 && !isEditing && !selectedChannelActive;

  const handleNext = async () => {
    if (currentStep === 0) {
      const valid = await form.trigger(['title', 'description', 'type', 'messageType']);
      if (!valid) return;
      // Safety net behind the disabled button.
      if (blockSettingsStep) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, stepsConfig.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const preparePayload = (data: CampaignFormValues): CampaignFormValues => {
    const now = new Date().toISOString();
    // testAB/split init defaults `scheduleTo` and `testabScheduleTo` to the
    // current ISO timestamp the moment the user changes `type`. If the user
    // takes a few seconds to reach the Schedule step, those timestamps fall
    // into the past and the backend rejects with 422 ("date cannot be in the
    // past"). Bump any defaulted timestamp that is in the past so the payload
    // always carries a future timestamp.
    const bumpIfPast = (iso: string): string => {
      if (!iso) return now;
      return new Date(iso).getTime() < Date.now() ? now : iso;
    };
    return {
      ...data,
      scheduleTo: bumpIfPast(data.scheduleTo),
      testabScheduleTo: bumpIfPast(data.testabScheduleTo),
      testabScheduleEnd: bumpIfPast(data.testabScheduleTo),
      steps: data.steps?.length
        ? data.steps
        : [[{ type: 'tag' as const, conditional_tag: 'in' as const, tag_id: [], tag_info: [] }]],
      campaignMessage: data.campaignMessage?.length ? data.campaignMessage : [{}],
      recurrenceSettings: {
        ...data.recurrenceSettings,
        date: data.recurrenceSettings?.date || now,
      },
    };
  };

  const hasDuplicateMessages = (messages: CampaignFormValues['campaignMessage']): boolean => {
    const ids = messages.filter((m) => m.id).map((m) => m.id);
    return ids.length !== new Set(ids).size;
  };

  const handleFormSubmit = (data: CampaignFormValues) => {
    if ((data.type === 'testAB' || data.type === 'split') && hasDuplicateMessages(data.campaignMessage ?? [])) {
      toast.error(t('campaigns.duplicateMessageWarning'));
      return;
    }
    onSubmit(preparePayload({ ...data, status: CampaignStatus.Scheduled }));
  };

  // Without this, `form.handleSubmit(handleFormSubmit)` silently no-ops when
  // Zod validation fails — no toast, no console, the button just dies.
  // Map each schema field to the step that owns it, so we can navigate the
  // wizard back to the first offending step and surface the issue.
  const STEP_BY_FIELD: Partial<Record<keyof CampaignFormValues, number>> = {
    title: 0,
    description: 0,
    type: 0,
    messageType: 0,
    name: 0,
    labels: 0,
    steps: 1,
    sendToAll: 1,
    campaignMessage: 2,
    scheduleTo: 3,
    recurrenceSettings: 3,
    testabScheduleTo: 3,
    testabScheduleEnd: 3,
    testabAudiencePercent: 3,
    testabCriteria: 3,
    testabSentAfterTest: 3,
    spreadSending: 3,
  };

  const handleInvalidSubmit = (errors: FieldErrors<CampaignFormValues>) => {
    const errorFields = Object.keys(errors) as (keyof CampaignFormValues)[];
    const stepsWithErrors = errorFields
      .map((field) => STEP_BY_FIELD[field])
      .filter((step): step is number => step !== undefined);
    const firstStep = stepsWithErrors.length ? Math.min(...stepsWithErrors) : null;

    if (firstStep !== null && firstStep < stepsConfig.length) {
      setCurrentStep(firstStep);
    }
    toast.error(t('campaigns.invalidFormFields'));
  };

  const handleSaveDraft = () => {
    const data = form.getValues();
    onSubmit(preparePayload({ ...data, status: CampaignStatus.Draft }));
  };

  // Determine which step to render based on step index
  // For campaign rules: Settings(0), Audience(1), Schedule(2), Review(3)
  // For regular: Settings(0), Audience(1), Content(2), Schedule(3), Review(4)
  const renderStep = () => {
    if (isCampaignRule) {
      switch (currentStep) {
        case 0:
          return (
            <SettingsStep
              form={form}
              campaignId={campaignId}
              isCampaignRule={isCampaignRule}
              isInternal={isInternal}
              disableSimple={disableSimple}
            />
          );
        case 1:
          return <AudienceStep form={form} isCampaignRule={isCampaignRule} isSuperAdmin={isSuperAdmin} />;
        case 2:
          return campaignType === 'recurring' ? (
            <RecurringStep form={form} isCampaignRule={isCampaignRule} />
          ) : (
            <ScheduleStep form={form} isCampaignRule={isCampaignRule} />
          );
        case 3:
          return <ReviewStep form={form} isCampaignRule={isCampaignRule} />;
        default:
          return null;
      }
    }

    switch (currentStep) {
      case 0:
        return (
          <SettingsStep
            form={form}
            campaignId={campaignId}
            isCampaignRule={isCampaignRule}
            isInternal={isInternal}
            disableSimple={disableSimple}
          />
        );
      case 1:
        return <AudienceStep form={form} isCampaignRule={isCampaignRule} isSuperAdmin={isSuperAdmin} />;
      case 2:
        return <ContentStep form={form} />;
      case 3:
        return campaignType === 'recurring' ? (
          <RecurringStep form={form} isCampaignRule={isCampaignRule} />
        ) : (
          <ScheduleStep form={form} isCampaignRule={isCampaignRule} />
        );
      case 4:
        return <ReviewStep form={form} isCampaignRule={isCampaignRule} />;
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Step Indicator */}
        <StepIndicator steps={stepsConfig} currentStep={currentStep} />

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">{renderStep()}</CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={onCancel} data-testid="cancel-button">
            {t('common.cancel')}
          </Button>

          <div className="flex gap-2">
            {!isCampaignRule && (!isEditing || (isEditingDraft && isLastStep)) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isPending || blockSettingsStep}
                data-testid="save-and-exit"
              >
                {t('campaigns.saveAndExit')}
              </Button>
            )}
            {currentStep > 0 && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                {t('campaigns.previous')}
              </Button>
            )}
            {isLastStep ? (
              <Button
                type="button"
                disabled={isPending}
                onClick={() => void form.handleSubmit(handleFormSubmit, handleInvalidSubmit)()}
              >
                {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} disabled={blockSettingsStep} data-testid="next-button">
                {t('campaigns.next')}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
