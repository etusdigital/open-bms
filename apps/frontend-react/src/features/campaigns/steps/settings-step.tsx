import { useState, useEffect, useRef } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Phone,
  Send,
  FlaskConical,
  GitBranch,
  RefreshCw,
  Info,
  X,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import type { AccountConfig } from '@/types';
import type { CampaignFormValues } from '../campaign-schema';
import { CAMPAIGN_TITLE_MAX, CAMPAIGN_TITLE_MAX_INTERNAL, CAMPAIGN_DESCRIPTION_MAX } from '../campaign-schema';
import type { CampaignMessageType, CampaignType } from '../types';
import { replaceSpecialChars } from '../utils';
import { useLabelsForCampaign } from '../use-campaign-labels';
import { useValidateCampaignName } from '../use-campaigns';

const ICON_MAP: Record<string, React.ElementType> = {
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Phone,
  Send,
  FlaskConical,
  GitBranch,
  RefreshCw,
};

interface ChannelOption {
  value: CampaignMessageType;
  labelKey: string;
  icon: string;
}

interface TypeOption {
  value: CampaignType;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  emailOnly?: boolean;
}

const CHANNELS: ChannelOption[] = [
  { value: 'email', labelKey: 'campaigns.channelEmail', icon: 'Mail' },
  { value: 'sms', labelKey: 'campaigns.channelSms', icon: 'MessageSquare' },
  { value: 'web-push', labelKey: 'campaigns.channelWebPush', icon: 'Bell' },
  { value: 'mobile-push', labelKey: 'campaigns.channelMobilePush', icon: 'Smartphone' },
  { value: 'whatsapp', labelKey: 'campaigns.channelWhatsapp', icon: 'Phone' },
];

const TYPES: TypeOption[] = [
  {
    value: 'simple',
    labelKey: 'campaigns.typeSimple',
    descriptionKey: 'campaigns.typeSimpleDesc',
    icon: 'Send',
  },
  {
    value: 'testAB',
    labelKey: 'campaigns.typeTestAB',
    descriptionKey: 'campaigns.typeTestABDesc',
    icon: 'FlaskConical',
    emailOnly: true,
  },
  {
    value: 'split',
    labelKey: 'campaigns.typeSplit',
    descriptionKey: 'campaigns.typeSplitDesc',
    icon: 'GitBranch',
    emailOnly: true,
  },
  {
    value: 'recurring',
    labelKey: 'campaigns.typeRecurring',
    descriptionKey: 'campaigns.typeRecurringDesc',
    icon: 'RefreshCw',
  },
];

const MAX_LABELS = 10;

/** Maps channel value to the account config name that controls its availability */
const CHANNEL_SETTINGS_CONFIG: Record<CampaignMessageType, string> = {
  email: 'email_settings',
  sms: 'sms_settings',
  'web-push': 'webpush_settings',
  'mobile-push': 'mobilepush_settings',
  whatsapp: 'whatsapp_settings',
};

function isChannelActive(configs: AccountConfig[], channel: CampaignMessageType): boolean {
  const configName = CHANNEL_SETTINGS_CONFIG[channel];
  const config = configs.find((c) => c.name === configName);
  if (!config?.value) return false;
  try {
    return !!JSON.parse(config.value).isActive;
  } catch {
    return false;
  }
}

interface SettingsStepProps {
  form: UseFormReturn<CampaignFormValues>;
  campaignId?: number;
  isCampaignRule?: boolean;
  isInternal?: boolean;
  disableSimple?: boolean;
}

export default function SettingsStep({
  form,
  campaignId,
  isCampaignRule = false,
  isInternal = false,
  disableSimple = false,
}: SettingsStepProps) {
  const { t } = useTranslation();
  // accountConfigs is an array (stable reference) — safe for Zustand selector
  const accountConfigs = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.accountConfigs : []));
  const titleLength = form.watch('title')?.length ?? 0;
  const messageType = form.watch('messageType');
  const campaignType = form.watch('type');
  const title = form.watch('title');
  const labels = form.watch('labels') ?? [];

  const maxTitleLength = CAMPAIGN_TITLE_MAX;

  // Debounced name validation — mirrors Vue2 debouncedValidateTitle/debouncedValidateName
  const debouncedTitle = useDebounce(title ?? '', 300);
  const utmName = form.watch('name');
  const debouncedUtmName = useDebounce(utmName ?? '', 300);
  const { data: titleValidation } = useValidateCampaignName(debouncedTitle, 'title', campaignId);
  const { data: nameValidation } = useValidateCampaignName(debouncedUtmName, 'name', campaignId);
  const isTitleTaken = Array.isArray(titleValidation) && titleValidation.length > 0;
  const isNameTaken = isInternal && !isCampaignRule && Array.isArray(nameValidation) && nameValidation.length > 0;

  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const debouncedLabelSearch = useDebounce(labelSearch, 300);
  const { data: labelOptions = [], isLoading: labelsLoading } = useLabelsForCampaign(debouncedLabelSearch);

  // Track if UTM was manually edited
  const utmManuallyEdited = useRef(false);

  // Auto-generate UTM name from title
  useEffect(() => {
    if (isInternal && !isCampaignRule && !utmManuallyEdited.current) {
      const generated = replaceSpecialChars(title ?? '').substring(0, CAMPAIGN_TITLE_MAX_INTERNAL);
      form.setValue('name', generated);
    }
  }, [title, isInternal, isCampaignRule, form]);

  const showInternalFields = isInternal && !isCampaignRule;

  const toggleLabel = (labelId: number, labelName: string) => {
    const current = form.getValues('labels') ?? [];
    const exists = current.some((l) => l.id === labelId);
    if (exists) {
      form.setValue(
        'labels',
        current.filter((l) => l.id !== labelId),
      );
    } else if (current.length < MAX_LABELS) {
      form.setValue('labels', [...current, { id: labelId, name: labelName }]);
    }
  };

  const removeLabel = (labelId: number) => {
    const current = form.getValues('labels') ?? [];
    form.setValue(
      'labels',
      current.filter((l) => l.id !== labelId),
    );
  };

  return (
    <div className="space-y-6">
      {/* Details Section */}
      <div>
        <h4 className="mb-3 text-sm font-medium">{t('campaigns.detailsSection')}</h4>
        <div className="space-y-4 rounded-lg border p-4">
          {/* Nome + UTM Campaign side-by-side */}
          {showInternalFields ? (
            <div className="grid grid-cols-2 gap-4">
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
                      <Input
                        {...field}
                        maxLength={maxTitleLength}
                        placeholder={t('campaigns.namePlaceholder')}
                        data-testid="campaign-title"
                      />
                    </FormControl>
                    <FormMessage />
                    {isTitleTaken && (
                      <p className="text-destructive text-xs" data-testid="title-not-available">
                        {t('campaigns.nameAlreadyExists')}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>{t('campaigns.utmCampaignField')}</FormLabel>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="text-muted-foreground h-3.5 w-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[200px] text-xs">{t('campaigns.utmCampaignTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={CAMPAIGN_TITLE_MAX_INTERNAL}
                        placeholder={t('campaigns.utmCampaignPlaceholder')}
                        data-testid="campaign-utm-name"
                        onChange={(e) => {
                          utmManuallyEdited.current = true;
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {isNameTaken && (
                      <p className="text-destructive text-xs" data-testid="utm-name-not-available">
                        {t('campaigns.utmNameAlreadyExists')}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>
          ) : (
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
                    <Input
                      {...field}
                      maxLength={maxTitleLength}
                      placeholder={t('campaigns.namePlaceholder')}
                      data-testid="campaign-title"
                    />
                  </FormControl>
                  <FormMessage />
                  {isTitleTaken && (
                    <p className="text-destructive text-xs" data-testid="title-not-available">
                      {t('campaigns.nameAlreadyExists')}
                    </p>
                  )}
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('campaigns.description')}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} maxLength={CAMPAIGN_DESCRIPTION_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Labels multi-select — visible for internal users and campaign rules */}
          {(showInternalFields || isCampaignRule) && (
            <FormField
              control={form.control}
              name="labels"
              render={() => (
                <FormItem>
                  <FormLabel>{t('campaigns.labelsLabel')}</FormLabel>
                  <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={labelsOpen}
                        className="w-full justify-between font-normal"
                        data-testid="labels-select"
                      >
                        <span className="text-muted-foreground">{t('campaigns.labelsPlaceholder')}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder={t('campaigns.searchLabels')}
                          value={labelSearch}
                          onValueChange={setLabelSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {labelsLoading ? t('common.loading') : t('campaigns.noLabelsFound')}
                          </CommandEmpty>
                          <CommandGroup>
                            {labelOptions.map((option) => {
                              const isSelected = labels.some((l) => l.id === option.value);
                              const isDisabled = !isSelected && labels.length >= MAX_LABELS;
                              return (
                                <CommandItem
                                  key={option.value}
                                  value={String(option.value)}
                                  disabled={isDisabled}
                                  onSelect={() => toggleLabel(option.value, option.label)}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                  {option.label}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {labels.map((label) => (
                        <Badge key={label.id} variant="secondary" className="gap-1">
                          {label.name}
                          <button
                            type="button"
                            onClick={() => removeLabel(label.id)}
                            className="hover:bg-muted rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">{t('campaigns.labelsMax')}</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Rate limit checkbox */}
          {showInternalFields && (
            <FormField
              control={form.control}
              name="isRateLimit"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="campaign-rate-limit"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">{t('campaigns.rateLimitLabel')}</FormLabel>
                </FormItem>
              )}
            />
          )}
        </div>
      </div>

      {/* Channel Cards */}
      <div>
        <h4 className="mb-3 text-sm font-medium">{t('campaigns.channelLabel')}</h4>
        <div className="grid grid-cols-5 gap-3" data-testid="channel-cards">
          {CHANNELS.map((channel) => {
            const Icon = ICON_MAP[channel.icon];
            const isSelected = messageType === channel.value;
            const isActive = isChannelActive(accountConfigs, channel.value);

            const btn = (
              <button
                key={channel.value}
                type="button"
                disabled={!isActive}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                  !isActive && 'cursor-not-allowed opacity-40',
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : isActive
                      ? 'border-border hover:border-primary/50'
                      : 'border-border',
                )}
                onClick={() => {
                  if (!isActive) return;
                  form.setValue('messageType', channel.value);
                  if (channel.value !== 'email' && (campaignType === 'testAB' || campaignType === 'split')) {
                    form.setValue('type', 'simple');
                  }
                }}
                data-testid={`channel-${channel.value}`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{t(channel.labelKey as never)}</span>
              </button>
            );

            return btn;
          })}
        </div>
      </div>

      {/* Campaign Type Cards */}
      <div>
        <h4 className="mb-3 text-sm font-medium">{t('campaigns.typeLabel')}</h4>
        <div className="grid grid-cols-4 gap-3" data-testid="type-cards">
          {TYPES.map((typeOpt) => {
            const Icon = ICON_MAP[typeOpt.icon];
            const isSelected = campaignType === typeOpt.value;
            const isHidden = typeOpt.emailOnly && messageType !== 'email';
            const isTypeDisabled = disableSimple && (typeOpt.value === 'simple' || typeOpt.value === 'recurring');

            if (isHidden) return null;

            return (
              <button
                key={typeOpt.value}
                type="button"
                disabled={isTypeDisabled}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
                  isTypeDisabled && 'cursor-not-allowed opacity-40',
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : isTypeDisabled
                      ? 'border-border'
                      : 'border-border hover:border-primary/50',
                )}
                onClick={() => {
                  if (!isTypeDisabled) form.setValue('type', typeOpt.value);
                }}
                data-testid={`type-${typeOpt.value}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">{t(typeOpt.labelKey as never)}</span>
                </div>
                <span className="text-muted-foreground text-xs">{t(typeOpt.descriptionKey as never)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
