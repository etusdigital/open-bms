import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import { SearchableApiSelect, type SelectOption } from './searchable-api-select';
import {
  CUSTOM_EVENT_CONDITIONALS,
  COMPARISON_OPERATORS,
  PERIOD_OPTIONS_CUSTOM_EVENT,
  WEEKDAY_OPTIONS,
  MAX_CUSTOM_DAYS_DEFAULT,
} from './constants';
import { StepField } from './interaction-step';
import { DatePickerField } from './date-picker-field';
import type { CustomEventStepData } from './types';

interface CustomEventOption {
  id: number;
  name: string;
  properties?: string[];
}

function useBuilderCustomEvents(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['builder-custom-events', accountId, search],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: CustomEventOption[] }>('/custom-events', {
        params: { page: 1, itemsPerPage: 50, ...(search && { title: search }) },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

interface CustomEventStepProps {
  data: CustomEventStepData;
  cardId: string;
}

export const CustomEventStep = memo(function CustomEventStep({ data, cardId }: CustomEventStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const [eventSearch, setEventSearch] = useState('');
  const { data: customEvents = [], isLoading: eventsLoading } = useBuilderCustomEvents(eventSearch);
  const eventOptions: SelectOption[] = useMemo(
    () => customEvents.map((e) => ({ value: String(e.id), label: e.name })),
    [customEvents],
  );
  const selectedEvent = customEvents.find((e) => e.id === data.event?.id);
  const eventProperties = selectedEvent?.properties ?? [];

  const isHas = data.conditional_event_type === 'in';
  const timeType = data.time_type ?? String(data.time ?? '');
  const showTimesFields = isHas;
  const showWeekday = timeType === 'current_week' || timeType === 'last_week';
  const showCustomDays = timeType === 'custom';
  const showDatePicker = timeType === 'date';
  const showDateRange = timeType === 'range';
  const properties = data.properties ?? [];

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

  const addProperty = () => {
    if (properties.length >= 3) return;
    update({ properties: [...properties, { property: '', value: '' }] });
  };

  const updateProperty = (index: number, field: 'property' | 'value', val: string) => {
    const updated = properties.map((p, i) => (i === index ? { ...p, [field]: val } : p));
    update({ properties: updated });
  };

  const removeProperty = (index: number) => {
    update({ properties: properties.filter((_, i) => i !== index) });
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
              if (evt) {
                update({
                  event: { id: evt.id, name: evt.name },
                  properties: [], // Reset properties when event changes
                });
              }
            }}
            options={eventOptions}
            isLoading={eventsLoading}
            onSearchChange={setEventSearch}
            disabled={meta.isDisabled}
            placeholder={t('segments.builder.event')}
          />
        </StepField>

        {/* Operator + Times (only when "has") */}
        {showTimesFields && (
          <>
            <StepField label={t('segments.builder.operators.greaterOrEqual', '>=')}>
              <Select
                value={data.conditional_times_value ?? '>='}
                onValueChange={(value) => update({ conditional_times_value: value })}
                disabled={meta.isDisabled}
              >
                <SelectTrigger size="sm" className="w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISON_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {t(op.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StepField>

            <StepField label={t('segments.builder.times')}>
              <Input
                className="h-8 w-[70px] text-xs"
                type="number"
                min="0"
                value={data.custom_times_value ?? 1}
                onChange={(e) => update({ custom_times_value: Number(e.target.value) })}
                disabled={meta.isDisabled}
              />
            </StepField>
          </>
        )}
      </div>

      {/* Period */}
      <div className="border-border/40 mt-2 flex flex-wrap gap-x-4 gap-y-3 border-t pt-2">
        <StepField label={t('segments.builder.period')}>
          <Select value={timeType} onValueChange={handleTimeChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[160px] text-xs">
              <SelectValue placeholder={t('common.select', 'Selecionar')} />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS_CUSTOM_EVENT.map((p) => (
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
            <span className="text-muted-foreground mb-1.5 text-xs whitespace-nowrap">
              {t('segments.builder.days')} ({t('segments.builder.maxDays', { max: MAX_CUSTOM_DAYS_DEFAULT })})
            </span>
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
          <StepField label={t('segments.builder.weekdays.monday', 'Dia da semana')}>
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

      {/* Properties (up to 3) */}
      {data.event && (
        <div className="border-border/40 mt-2 space-y-2 border-t pt-2">
          {properties.map((prop, index) => (
            <div key={index} className="flex items-end gap-2">
              <StepField label={t('segments.builder.customEvent.property')}>
                {eventProperties.length > 0 ? (
                  <Select
                    value={prop.property}
                    onValueChange={(value) => updateProperty(index, 'property', value)}
                    disabled={meta.isDisabled}
                  >
                    <SelectTrigger size="sm" className="w-[150px] text-xs">
                      <SelectValue placeholder={t('common.select', 'Selecionar')} />
                    </SelectTrigger>
                    <SelectContent>
                      {eventProperties.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 w-[150px] text-xs"
                    value={prop.property}
                    onChange={(e) => updateProperty(index, 'property', e.target.value)}
                    placeholder={t('segments.builder.customEvent.property')}
                    disabled={meta.isDisabled}
                  />
                )}
              </StepField>
              <StepField label={t('segments.builder.customEvent.propertyValue')}>
                <Input
                  className="h-8 w-[150px] text-xs"
                  value={prop.value}
                  onChange={(e) => updateProperty(index, 'value', e.target.value)}
                  disabled={meta.isDisabled}
                />
              </StepField>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                onClick={() => removeProperty(index)}
                disabled={meta.isDisabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {properties.length < 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 gap-1 text-xs"
              onClick={addProperty}
              disabled={meta.isDisabled}
            >
              <Plus className="h-3 w-3" />
              {t('segments.builder.customEvent.addProperty')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
