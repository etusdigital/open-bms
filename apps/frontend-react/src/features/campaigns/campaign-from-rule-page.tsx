import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { FormPage } from '@/components/form-page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useAppStore } from '@/stores/app-store';
import { useDebounce } from '@/hooks/use-debounce';
import ContentStep from './steps/content-step';
import ReviewStep from './steps/review-step';
import { useCreateCampaign, useValidateCampaignName } from './use-campaigns';
import { useCampaignRuleStore } from '@/stores/campaign-rule-store';
import {
  campaignFormSchema,
  type CampaignFormValues,
  CAMPAIGN_TITLE_MAX,
  CAMPAIGN_TITLE_MAX_INTERNAL,
  CAMPAIGN_DESCRIPTION_MAX,
} from './campaign-schema';
import { CampaignStatus } from './types';
import { replaceSpecialChars } from './utils';
import type { CampaignConfig } from '@/features/campaign-rules/types';

/** Merges HH:mm time from config with selected date */
function mergeTimeWithDate(time: string | undefined, date: string): string {
  if (!time || !time.includes(':')) return `${date}T00:00`;
  return `${date}T${time}`;
}

export default function CampaignFromRulePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateCampaign();

  const auth = useAppStore((s) => s.auth);
  const isInternal = auth.status === 'authenticated' ? auth.account.isInternal : false;

  const schedule = useCampaignRuleStore((s) => s.schedule);
  const currentIndex = useCampaignRuleStore((s) => s.currentIndex);
  const nextConfig = useCampaignRuleStore((s) => s.nextConfig);
  const clear = useCampaignRuleStore((s) => s.clear);

  // Redirect if no schedule data (e.g. direct URL access)
  useEffect(() => {
    if (!schedule) {
      navigate({ to: '/campaigns', search: {} as never });
    }
  }, [schedule, navigate]);

  if (!schedule) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('campaigns.createFromRule')}
          backTo="/campaigns"
          backLabel={t('campaigns.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const currentConfig = schedule.configs[currentIndex];
  const remaining = schedule.configs.length - currentIndex - 1;

  // All configs processed
  if (!currentConfig) {
    clear();
    navigate({ to: '/campaigns', search: {} as never });
    return null;
  }

  const handleSaved = () => {
    toast.success(t('campaigns.campaignCreatedSuccess'));
    if (remaining > 0) {
      nextConfig();
    } else {
      clear();
      navigate({ to: '/campaigns', search: {} as never });
    }
  };

  const handleSkip = () => {
    if (remaining > 0) {
      nextConfig();
    } else {
      clear();
      navigate({ to: '/campaigns', search: {} as never });
    }
  };

  return (
    <FormPage.Root>
      <FormPage.Header title={t('campaigns.createFromRule')} backTo="/campaigns" backLabel={t('campaigns.pageTitle')} />
      <FormPage.Content>
        {remaining > 0 && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>{t('campaigns.remainingCampaigns', { total: remaining })}</AlertDescription>
          </Alert>
        )}

        <TemplateForm
          key={currentIndex}
          config={currentConfig}
          date={schedule.date}
          isInternal={isInternal}
          isPending={createMutation.isPending}
          onSave={(data) => {
            createMutation.mutate(data, { onSuccess: handleSaved });
          }}
          onSkip={handleSkip}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}

/* ── Flat template form (matches Vue2 campaigns-template-view) ───── */

interface TemplateFormProps {
  config: CampaignConfig;
  date: string;
  isInternal: boolean;
  isPending: boolean;
  onSave: (data: CampaignFormValues) => void;
  onSkip: () => void;
}

function TemplateForm({ config, date, isInternal, isPending, onSave, onSkip }: TemplateFormProps) {
  const { t } = useTranslation();
  const configData = (config.configs ?? {}) as Partial<CampaignFormValues>;
  const maxTitleLength = isInternal ? CAMPAIGN_TITLE_MAX_INTERNAL : CAMPAIGN_TITLE_MAX;

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema) as never,
    defaultValues: {
      type: 'simple' as const,
      messageType: 'email' as const,
      sendToAll: false,
      sendAfterCreate: false,
      runSegment: false,
      isRateLimit: true,
      spreadSending: 60,
      steps: [],
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
      testabAudiencePercent: 10,
      testabCriteria: 'open' as const,
      testabSentAfterTest: true,
      confirmSaveDuplicate: false,
      ...configData,
      // Override with merged date+time and empty user fields
      title: '',
      name: '',
      description: '',
      scheduleTo: mergeTimeWithDate(configData.scheduleTo as string | undefined, date),
      testabScheduleTo: mergeTimeWithDate(configData.testabScheduleTo as string | undefined, date),
      testabScheduleEnd: mergeTimeWithDate(configData.testabScheduleEnd as string | undefined, date),
      campaignMessage: [],
    },
  });

  const title = form.watch('title');
  const titleLength = title?.length ?? 0;
  const utmManuallyEdited = useRef(false);

  // Auto-generate UTM name from title
  useEffect(() => {
    if (isInternal && !utmManuallyEdited.current) {
      const generated = replaceSpecialChars(title ?? '').substring(0, maxTitleLength);
      form.setValue('name', generated);
    }
  }, [title, isInternal, maxTitleLength, form]);

  // Debounced name validation
  const debouncedTitle = useDebounce(title ?? '', 300);
  const utmName = form.watch('name');
  const debouncedUtmName = useDebounce(utmName ?? '', 300);
  const { data: titleValidation } = useValidateCampaignName(debouncedTitle, 'title');
  const { data: nameValidation } = useValidateCampaignName(debouncedUtmName, 'name');
  const isTitleTaken = Array.isArray(titleValidation) && titleValidation.length > 0;
  const isNameTaken = isInternal && Array.isArray(nameValidation) && nameValidation.length > 0;

  const handleSave = () => {
    const data = form.getValues();

    if (!data.title || data.title.length < 1) {
      form.setError('title', { message: t('validation.required') });
      return;
    }

    if (data.campaignMessage.length === 0 || !data.campaignMessage[0]?.id) {
      toast.error(t('campaigns.noMessageError'));
      return;
    }

    onSave({ ...data, status: CampaignStatus.Scheduled });
  };

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Details Section */}
        <div>
          <h4 className="mb-3 text-base font-medium">{t('campaigns.detailsSection')}</h4>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t('campaigns.currentConfig')}</span>
                <span className="text-primary text-sm font-semibold">{config.name}</span>
              </div>

              <div className={isInternal ? 'grid grid-cols-2 gap-4' : ''}>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t('campaigns.nameField')}</FormLabel>
                        <span className="text-muted-foreground text-xs">
                          {titleLength}/{maxTitleLength}
                        </span>
                      </div>
                      <FormControl>
                        <Input {...field} maxLength={maxTitleLength} placeholder={t('campaigns.namePlaceholder')} />
                      </FormControl>
                      <FormMessage />
                      {isTitleTaken && <p className="text-destructive text-xs">{t('campaigns.nameAlreadyExists')}</p>}
                    </FormItem>
                  )}
                />

                {isInternal && (
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('campaigns.utmCampaignField')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            maxLength={CAMPAIGN_TITLE_MAX_INTERNAL}
                            placeholder={t('campaigns.utmCampaignPlaceholder')}
                            onChange={(e) => {
                              utmManuallyEdited.current = true;
                              field.onChange(e);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        {isNameTaken && (
                          <p className="text-destructive text-xs">{t('campaigns.utmNameAlreadyExists')}</p>
                        )}
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaigns.description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        {...field}
                        maxLength={CAMPAIGN_DESCRIPTION_MAX}
                        placeholder={t('campaigns.descriptionPlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Content Section */}
        <div>
          <h4 className="mb-3 text-base font-medium">{t('campaigns.stepContent')}</h4>
          <Card>
            <CardContent className="pt-6">
              <ContentStep form={form} />
            </CardContent>
          </Card>
        </div>

        {/* Audience + Schedule (via ReviewStep with isTemplateCampaign behavior) */}
        <ReviewStep form={form} isCampaignRule={false} isTemplateCampaign />

        {/* Footer Buttons */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onSkip}>
            {t('campaigns.skipRule')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </Form>
  );
}
