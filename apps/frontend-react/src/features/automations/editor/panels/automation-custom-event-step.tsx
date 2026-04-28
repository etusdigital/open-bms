/**
 * Automation-specific custom event step.
 * Same as segment builder's CustomEventStep but:
 * - No count fields (operator + times) — removed for automations
 * - Updated period labels for current_week/last_week
 * - Weekday label changed to "Dia da semana"
 * - No properties section
 */
import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useBuilderActions, useBuilderMeta } from '@/features/segments/builder/builder-context';
import { CUSTOM_EVENT_CONDITIONALS, MAX_CUSTOM_DAYS_DEFAULT } from '@/features/segments/builder/constants';
import { SearchableApiSelect, type SelectOption } from '@/features/segments/builder/searchable-api-select';
import { StepField } from '@/features/segments/builder/interaction-step';
import { DatePickerField } from '@/features/segments/builder/date-picker-field';
import type { CustomEventStepData } from '@/features/segments/builder/types';

// Automation-specific period options with updated labels
const AUTOMATION_PERIOD_OPTIONS = [
  { value: '0', labelKey: 'segments.builder.periods.today' },
  { value: '1', labelKey: 'segments.builder.periods.yesterday' },
  { value: '7', labelKey: 'segments.builder.periods.last7Days' },
  { value: '15', labelKey: 'segments.builder.periods.last15Days' },
  { value: 'date', labelKey: 'segments.builder.periods.date' },
  { value: 'range', labelKey: 'segments.builder.periods.range' },
  { value: 'custom', labelKey: 'segments.builder.periods.custom' },
  { value: 'current_week', labelKey: 'automations.editor.customEvent.currentWeekFrom' },
  { value: 'last_week', labelKey: 'automations.editor.customEvent.lastWeekFrom' },
] as const;

const WEEKDAY_OPTIONS = [
  { value: '1', labelKey: 'segments.builder.weekdays.monday' },
  { value: '2', labelKey: 'segments.builder.weekdays.tuesday' },
  { value: '3', labelKey: 'segments.builder.weekdays.wednesday' },
  { value: '4', labelKey: 'segments.builder.weekdays.thursday' },
  { value: '5', labelKey: 'segments.builder.weekdays.friday' },
  { value: '6', labelKey: 'segments.builder.weekdays.saturday' },
  { value: '0', labelKey: 'segments.builder.weekdays.sunday' },
] as const;

function useBuilderCustomEvents(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery({
    queryKey: ['builder-custom-events', accountId, search],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: Array<{ id: number; name: string }> }>('/custom-events', {
        params: { page: 1, itemsPerPage: 50, ...(search && { title: search }) },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

interface Props {
  data: CustomEventStepData;
  cardId: string;
}

export const AutomationCustomEventStep = memo(function AutomationCustomEventStep({ data, cardId }: Props) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const [eventSearch, setEventSearch] = useState('');
  const { data: customEvents = [], isLoading } = useBuilderCustomEvents(eventSearch);
  const eventOptions: SelectOption[] = useMemo(
    () => customEvents.map((e) => ({ value: String(e.id), label: e.name })),
    [customEvents],
  );

  const timeType = data.time_type ?? String(data.time ?? '');
  const showWeekday = timeType === 'current_week' || timeType === 'last_week';
  const showCustomDays = timeType === 'custom';
  const showDatePicker = timeType === 'date';
  const showDateRange = timeType === 'range';

  const update = (field: Partial<Omit<CustomEventStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'custom_event', field);
  };

  const handleTimeChange = (value: string) => {
    const numericPeriods = ['0', '1', '7', '15'];
    if (numericPeriods.includes(value)) {
      update({
        time: Number(value),
        time_type: null,
        custom_event_date: null,
        custom_event_date_end: null,
      });
    } else {
      update({
        time: 0,
        time_type: value,
        time_custom: value === 'custom' ? (data.time_custom ?? 7) : null,
      });
    }
  };

  return (
    <div className="bg-secondary/30 space-y-3 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Conditional: has / doesn't have */}
        <StepField label={t('segments.builder.conditional')}>
          <Select
            value={data.conditional_event_type ?? 'in'}
            onValueChange={(value) => update({ conditional_event_type: value as 'in' | 'not in' })}
            disabled={meta.isDisabled}
          >
            <SelectTrigger size="sm" className="w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_EVENT_CONDITIONALS.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-xs">
                  {t(c.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Event searchable select */}
        <StepField label={t('segments.builder.event')}>
          <SearchableApiSelect
            value={data.event ? String(data.event.id) : ''}
            onValueChange={(value) => {
              const evt = customEvents.find((e) => String(e.id) === value);
              if (evt) update({ event: { id: evt.id, name: evt.name } });
            }}
            options={eventOptions}
            isLoading={isLoading}
            onSearchChange={setEventSearch}
            disabled={meta.isDisabled}
            placeholder={t('segments.builder.event')}
          />
        </StepField>

        {/* No operator/times fields for automations */}
      </div>

      {/* Period */}
      <div className="border-border/40 mt-2 flex flex-wrap gap-x-4 gap-y-3 border-t pt-2">
        <StepField label={t('segments.builder.period')}>
          <Select value={timeType} onValueChange={handleTimeChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[200px] text-xs">
              <SelectValue placeholder={t('common.select', 'Selecionar')} />
            </SelectTrigger>
            <SelectContent>
              {AUTOMATION_PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {t(p.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {showCustomDays && (
          <div className="flex items-end gap-2">
            <Input
              className="h-8 w-[70px] text-xs"
              type="number"
              min="1"
              max={MAX_CUSTOM_DAYS_DEFAULT}
              value={data.time_custom ?? 7}
              onChange={(e) => update({ time_custom: Math.min(Number(e.target.value), MAX_CUSTOM_DAYS_DEFAULT) })}
              disabled={meta.isDisabled}
            />
            <span className="text-muted-foreground mb-1.5 text-xs whitespace-nowrap">{t('segments.builder.days')}</span>
          </div>
        )}

        {showDatePicker && (
          <StepField label={t('segments.builder.periods.date')}>
            <DatePickerField
              value={data.custom_event_date}
              onChange={(value) => update({ custom_event_date: value })}
              disabled={meta.isDisabled}
            />
          </StepField>
        )}

        {showDateRange && (
          <StepField label={t('segments.builder.periods.range')}>
            <div className="flex items-center gap-2">
              <DatePickerField
                value={data.custom_event_date}
                onChange={(value) => update({ custom_event_date: value })}
                disabled={meta.isDisabled}
              />
              <span className="text-muted-foreground text-xs">—</span>
              <DatePickerField
                value={data.custom_event_date_end}
                onChange={(value) => update({ custom_event_date_end: value })}
                disabled={meta.isDisabled}
              />
            </div>
          </StepField>
        )}

        {showWeekday && (
          <StepField label={t('automations.editor.customEvent.weekday')}>
            <Select
              value={data.conditional_week_day_filter ?? '1'}
              onValueChange={(value) => update({ conditional_week_day_filter: value })}
              disabled={meta.isDisabled}
            >
              <SelectTrigger size="sm" className="w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_OPTIONS.map((w) => (
                  <SelectItem key={w.value} value={w.value} className="text-xs">
                    {t(w.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StepField>
        )}
      </div>
    </div>
  );
});
