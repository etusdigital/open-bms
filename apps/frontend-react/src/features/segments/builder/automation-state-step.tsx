import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import {
  AUTOMATION_STATE_ACTIONS,
  COMPARISON_OPERATORS,
  PERIOD_OPTIONS_AUTOMATION,
  MAX_CUSTOM_DAYS_AUTOMATION,
} from './constants';
import { SearchableApiSelect, type SelectOption } from './searchable-api-select';
import { StepField } from './interaction-step';
import type { AutomationStateStepData } from './types';

interface AutomationOption {
  id: number;
  name?: string;
  title?: string;
}

function useBuilderAutomations(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['builder-automations', accountId, search],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: AutomationOption[] }>('/automations', {
        params: { page: 1, itemsPerPage: 50, ...(search && { title: search }) },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

interface AutomationStateStepProps {
  data: AutomationStateStepData;
  cardId: string;
}

export const AutomationStateStep = memo(function AutomationStateStep({ data, cardId }: AutomationStateStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const [automationSearch, setAutomationSearch] = useState('');
  const { data: automations = [], isLoading: automationsLoading } = useBuilderAutomations(automationSearch);
  const automationOptions: SelectOption[] = useMemo(
    () => automations.map((a) => ({ value: String(a.id), label: a.name || a.title || String(a.id) })),
    [automations],
  );
  const currentAutomationValue =
    data.automation === 'any'
      ? 'any'
      : typeof data.automation === 'object' && data.automation
        ? String(data.automation.id)
        : '';

  const update = (field: Partial<Omit<AutomationStateStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'automation_state', field);
  };

  const handleTimeChange = (value: string) => {
    if (value === 'custom') {
      update({ time: 'custom', time_custom: data.time_custom ?? 7 });
    } else {
      update({ time: Number(value) });
    }
  };

  return (
    <div className="bg-secondary/30 space-y-3 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Action */}
        <StepField label={t('segments.builder.action')}>
          <Select
            value={data.event ?? 'entered'}
            onValueChange={(value) => update({ event: value })}
            disabled={meta.isDisabled}
          >
            <SelectTrigger size="sm" className="w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTOMATION_STATE_ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value} className="text-xs">
                  {t(a.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Automation searchable select */}
        <StepField label={t('segments.builder.automation')}>
          <SearchableApiSelect
            value={currentAutomationValue}
            onValueChange={(value) => {
              if (value === 'any') {
                update({ automation: 'any' });
              } else {
                const auto = automations.find((a) => String(a.id) === value);
                if (auto) update({ automation: { id: auto.id, name: auto.name, title: auto.title } });
              }
            }}
            options={automationOptions}
            isLoading={automationsLoading}
            onSearchChange={setAutomationSearch}
            fixedOption={{ value: 'any', label: t('segments.builder.anyAutomation') }}
            disabled={meta.isDisabled}
            placeholder={t('segments.builder.automation')}
          />
        </StepField>

        {/* Operator + Times */}
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
            value={data.custom_times_value ?? 0}
            onChange={(e) => update({ custom_times_value: Number(e.target.value) })}
            disabled={meta.isDisabled}
          />
        </StepField>
      </div>

      {/* Period */}
      <div className="border-border/40 mt-2 flex flex-wrap gap-x-4 gap-y-3 border-t pt-2">
        <StepField label={t('segments.builder.period')}>
          <Select value={String(data.time ?? '')} onValueChange={handleTimeChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[160px] text-xs">
              <SelectValue placeholder={t('common.select', 'Selecionar')} />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS_AUTOMATION.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {t(p.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {data.time === 'custom' && (
          <div className="flex items-end gap-2">
            <Input
              className="h-8 w-[70px] text-xs"
              type="number"
              min="1"
              max={MAX_CUSTOM_DAYS_AUTOMATION}
              value={data.time_custom ?? 7}
              onChange={(e) =>
                update({
                  time_custom: Math.min(Number(e.target.value), MAX_CUSTOM_DAYS_AUTOMATION),
                })
              }
              disabled={meta.isDisabled}
            />
            <span className="text-muted-foreground mb-1.5 text-xs whitespace-nowrap">
              {t('segments.builder.days')} ({t('segments.builder.maxDays', { max: MAX_CUSTOM_DAYS_AUTOMATION })})
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
