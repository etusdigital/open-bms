import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CampaignFormValues } from '../campaign-schema';
import { SPREAD_SENDING_OPTIONS } from '../types';

interface ScheduleStepProps {
  form: UseFormReturn<CampaignFormValues>;
  isCampaignRule?: boolean;
}

export default function ScheduleStep({ form, isCampaignRule = false }: ScheduleStepProps) {
  const { t } = useTranslation();
  const campaignType = form.watch('type');
  const sendAfterCreate = form.watch('sendAfterCreate');
  const messageType = form.watch('messageType');
  const messages = form.watch('campaignMessage') ?? [];
  const isTestAB = campaignType === 'testAB';
  const testabAudiencePercent = form.watch('testabAudiencePercent') ?? 10;
  const testabSentAfterTest = form.watch('testabSentAfterTest') ?? true;

  return (
    <div className="space-y-6" data-testid="schedule-step">
      {/* Distribution card — TestAB only */}
      {isTestAB && (
        <Card data-testid="testab-section">
          <CardHeader>
            <CardTitle className="text-sm">{t('campaigns.distributionTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Winner criteria */}
            <div>
              <Label className="mb-2 block text-sm">{t('campaigns.testabCriteriaLabel')}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center text-sm transition-colors',
                    form.watch('testabCriteria') === 'open'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                  onClick={() => form.setValue('testabCriteria', 'open')}
                  data-testid="criteria-open"
                >
                  {t('campaigns.testabCriteriaOpen')}
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center text-sm transition-colors',
                    form.watch('testabCriteria') === 'click'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                  onClick={() => form.setValue('testabCriteria', 'click')}
                  data-testid="criteria-click"
                >
                  {t('campaigns.testabCriteriaClick')}
                </button>
              </div>
            </div>

            {/* Audience slider */}
            <div>
              <Label className="mb-2 block text-sm">
                {t('campaigns.testabAudienceLabel')}: {testabAudiencePercent}%
              </Label>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={testabAudiencePercent}
                onChange={(e) => form.setValue('testabAudiencePercent', Number(e.target.value))}
                className="w-full"
                data-testid="testab-slider"
              />
              {messages.length > 0 && (
                <div className="text-muted-foreground mt-2 flex gap-2 text-xs">
                  {messages.map((_, i) => (
                    <span key={i}>
                      {String.fromCharCode(65 + i)}: {Math.round(testabAudiencePercent / messages.length)}%
                    </span>
                  ))}
                  <span>
                    {t('campaigns.winnerMessage')}: {100 - testabAudiencePercent}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispatch card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('campaigns.dispatchTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Send timing */}
          <div>
            <h4 className="mb-3 text-sm font-medium">{t('campaigns.scheduleToLabel')}</h4>
            <div className="space-y-2">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                  sendAfterCreate ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                )}
                onClick={() => form.setValue('sendAfterCreate', true)}
                data-testid="send-now"
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border-2',
                    sendAfterCreate ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                />
                {t('campaigns.sendNow')}
              </button>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
                  !sendAfterCreate ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                )}
                onClick={() => form.setValue('sendAfterCreate', false)}
                data-testid="send-scheduled"
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border-2',
                    !sendAfterCreate ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                />
                {t('campaigns.sendScheduled')}
              </button>
            </div>
          </div>

          {/* Non-TestAB: single date picker when scheduled */}
          {!sendAfterCreate && !isTestAB && (
            <FormField
              control={form.control}
              name="scheduleTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('campaigns.dateSendCampaign')}</FormLabel>
                  <FormControl>
                    {isCampaignRule ? (
                      <Input type="time" {...field} data-testid="schedule-time" />
                    ) : (
                      <Input type="datetime-local" {...field} data-testid="schedule-datetime" />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* TestAB: test schedule dates — only when scheduled */}
          {!sendAfterCreate && isTestAB && (
            <>
              <FormField
                control={form.control}
                name="testabScheduleTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaigns.testabScheduleStart')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="testab-start" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* TestAB: Don't send winner checkbox */}
          {isTestAB && (
            <div className="flex items-center gap-3">
              <Checkbox
                checked={!testabSentAfterTest}
                onCheckedChange={(checked) => form.setValue('testabSentAfterTest', !checked)}
                data-testid="testab-no-winner"
              />
              <Label>{t('campaigns.testabSentAfterTestLabel')}</Label>
            </div>
          )}

          {/* TestAB: Winner send schedule — only when scheduled AND sending winner */}
          {isTestAB && testabSentAfterTest && !sendAfterCreate && (
            <FormField
              control={form.control}
              name="scheduleTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('campaigns.testabWinnerSchedule')}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} data-testid="winner-schedule" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Spread sending — hidden for web-push */}
          {messageType !== 'web-push' && (
            <div>
              <Label className="mb-2 block text-sm">{t('campaigns.spreadSendingLabel')}</Label>
              <Select
                value={String(form.watch('spreadSending') ?? 60)}
                onValueChange={(v) => form.setValue('spreadSending', Number(v))}
              >
                <SelectTrigger data-testid="spread-sending">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPREAD_SENDING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {'labelParams' in opt
                        ? t(opt.labelKey, opt.labelParams as Record<string, unknown>)
                        : t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
