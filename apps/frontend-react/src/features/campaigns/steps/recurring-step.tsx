import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CampaignFormValues } from '../campaign-schema';
import { RecurrenceFrequency, SPREAD_SENDING_OPTIONS } from '../types';

interface RecurringStepProps {
  form: UseFormReturn<CampaignFormValues>;
  isCampaignRule?: boolean;
}

const WEEK_DAYS = [
  { value: 0, labelKey: 'D' },
  { value: 1, labelKey: 'S' },
  { value: 2, labelKey: 'T' },
  { value: 3, labelKey: 'Q' },
  { value: 4, labelKey: 'Q' },
  { value: 5, labelKey: 'S' },
  { value: 6, labelKey: 'S' },
];

export default function RecurringStep({ form, isCampaignRule = false }: RecurringStepProps) {
  const { t } = useTranslation();
  const recurrenceSettings = form.watch('recurrenceSettings');
  const interval = recurrenceSettings?.interval ?? 1;
  const frequency = recurrenceSettings?.frequency;
  const weekDays = recurrenceSettings?.weekDays ?? [];
  const hasExpiration = recurrenceSettings?.hasExpiration ?? false;
  const messageType = form.watch('messageType');

  const setRecurrenceField = (field: string, value: unknown) => {
    const current = form.getValues('recurrenceSettings') ?? {};
    form.setValue('recurrenceSettings', { ...current, [field]: value });
  };

  const getFrequencyLabel = (freq: number | null | undefined) => {
    if (freq === RecurrenceFrequency.Daily)
      return interval > 1 ? t('campaigns.frequencyDailyPlural') : t('campaigns.frequencyDaily');
    if (freq === RecurrenceFrequency.Weekly)
      return interval > 1 ? t('campaigns.frequencyWeeklyPlural') : t('campaigns.frequencyWeekly');
    if (freq === RecurrenceFrequency.Monthly)
      return interval > 1 ? t('campaigns.frequencyMonthlyPlural') : t('campaigns.frequencyMonthly');
    return '';
  };

  const toggleWeekDay = (day: number) => {
    const current = weekDays ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setRecurrenceField('weekDays', next);
  };

  // Expiration mode: 'never' | 'date' | 'count'
  const expirationMode = !hasExpiration ? 'never' : recurrenceSettings?.untilDate ? 'date' : 'count';

  const setExpirationMode = (mode: 'never' | 'date' | 'count') => {
    if (mode === 'never') {
      setRecurrenceField('hasExpiration', false);
      setRecurrenceField('untilDate', null);
      setRecurrenceField('untilSend', null);
    } else if (mode === 'date') {
      setRecurrenceField('hasExpiration', true);
      setRecurrenceField('untilDate', '');
      setRecurrenceField('untilSend', null);
    } else {
      setRecurrenceField('hasExpiration', true);
      setRecurrenceField('untilDate', null);
      setRecurrenceField('untilSend', 1);
    }
  };

  return (
    <div className="space-y-6" data-testid="recurring-step">
      {/* First send date/time */}
      <div>
        <h4 className="mb-3 text-sm font-medium">{t('campaigns.recurrenceDate')}</h4>
        <div className="flex gap-3">
          {!isCampaignRule && (
            <FormField
              control={form.control}
              name="recurrenceSettings.date"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>{t('campaigns.recurrenceDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="recurrence-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="flex-1">
            <Label className="mb-2 block text-sm">{t('campaigns.recurrenceTime')}</Label>
            <Input
              type="time"
              value={
                recurrenceSettings?.date?.includes('T')
                  ? (recurrenceSettings.date.split('T')[1]?.substring(0, 5) ?? '')
                  : ''
              }
              onChange={(e) => {
                const currentDate = recurrenceSettings?.date?.split('T')[0] ?? new Date().toISOString().split('T')[0];
                setRecurrenceField('date', `${currentDate}T${e.target.value}`);
              }}
              data-testid="recurrence-time"
            />
          </div>
        </div>
      </div>

      {/* Repeat interval + frequency */}
      <div>
        <h4 className="mb-3 text-sm font-medium">{t('campaigns.recurrenceInterval')}</h4>
        <div className="flex items-end gap-3">
          <div className="w-24">
            <Input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setRecurrenceField('interval', Math.max(1, Number(e.target.value)))}
              data-testid="recurrence-interval"
            />
          </div>
          <div className="flex-1">
            <Select
              value={frequency != null ? String(frequency) : ''}
              onValueChange={(v) => setRecurrenceField('frequency', Number(v))}
            >
              <SelectTrigger data-testid="recurrence-frequency">
                <SelectValue placeholder={t('campaigns.recurrenceFrequency')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(RecurrenceFrequency.Daily)}>
                  {getFrequencyLabel(RecurrenceFrequency.Daily)}
                </SelectItem>
                <SelectItem value={String(RecurrenceFrequency.Weekly)}>
                  {getFrequencyLabel(RecurrenceFrequency.Weekly)}
                </SelectItem>
                <SelectItem value={String(RecurrenceFrequency.Monthly)}>
                  {getFrequencyLabel(RecurrenceFrequency.Monthly)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Week day selection (only for weekly) */}
      {frequency === RecurrenceFrequency.Weekly && (
        <div>
          <Label className="mb-2 block text-sm">{t('campaigns.weekDaysLabel')}</Label>
          <div className="flex gap-2" data-testid="week-days">
            {WEEK_DAYS.map((day) => (
              <Button
                key={day.value}
                type="button"
                size="sm"
                variant={weekDays.includes(day.value) ? 'default' : 'outline'}
                className="h-9 w-9 p-0"
                onClick={() => toggleWeekDay(day.value)}
                data-testid={`weekday-${day.value}`}
              >
                {day.labelKey}
              </Button>
            ))}
          </div>
          <FormMessage />
        </div>
      )}

      {/* Expiration */}
      <div>
        <h4 className="mb-3 text-sm font-medium">{t('campaigns.expirationLabel')}</h4>
        <div className="space-y-2">
          {/* Never */}
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
              expirationMode === 'never' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}
            onClick={() => setExpirationMode('never')}
            data-testid="expiration-never"
          >
            <div
              className={cn(
                'h-4 w-4 rounded-full border-2',
                expirationMode === 'never' ? 'border-primary bg-primary' : 'border-muted-foreground',
              )}
            />
            {t('campaigns.expirationNever')}
          </button>

          {/* Date */}
          <div
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
              expirationMode === 'date' ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <button type="button" className="flex items-center gap-3" onClick={() => setExpirationMode('date')}>
              <div
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  expirationMode === 'date' ? 'border-primary bg-primary' : 'border-muted-foreground',
                )}
              />
              {t('campaigns.expirationDate')}
            </button>
            {expirationMode === 'date' && (
              <Input
                type="date"
                value={recurrenceSettings?.untilDate ?? ''}
                onChange={(e) => setRecurrenceField('untilDate', e.target.value)}
                className="ml-auto w-44"
                data-testid="expiration-date-input"
              />
            )}
          </div>

          {/* Count */}
          <div
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
              expirationMode === 'count' ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            <button type="button" className="flex items-center gap-3" onClick={() => setExpirationMode('count')}>
              <div
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  expirationMode === 'count' ? 'border-primary bg-primary' : 'border-muted-foreground',
                )}
              />
              {t('campaigns.expirationCount')}
            </button>
            {expirationMode === 'count' && (
              <div className="ml-auto flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={recurrenceSettings?.untilSend ?? 1}
                  onChange={(e) => setRecurrenceField('untilSend', Math.max(1, Number(e.target.value)))}
                  className="w-20"
                  data-testid="expiration-count-input"
                />
                <span className="text-muted-foreground text-xs">{t('campaigns.expirationSends')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spread sending (hidden for WebPush) */}
      {messageType !== 'web-push' && (
        <div>
          <Label className="mb-2 block text-sm">{t('campaigns.spreadSendingLabel')}</Label>
          <Select
            value={String(form.watch('spreadSending') ?? 60)}
            onValueChange={(v) => form.setValue('spreadSending', Number(v))}
          >
            <SelectTrigger data-testid="recurring-spread-sending">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPREAD_SENDING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {'labelParams' in opt ? t(opt.labelKey, opt.labelParams as Record<string, unknown>) : t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
