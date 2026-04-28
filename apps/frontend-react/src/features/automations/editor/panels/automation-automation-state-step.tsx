/**
 * Automation-specific automation filter step.
 * Simplified vs segment builder:
 * - No action select (entered/completed/running)
 * - No count fields (operator + times)
 * - Multi-select automations (chips with remove)
 * - Simple period: "last N days" input, max 90
 *
 * Stores data as: user_field_key='automation_entry',
 * user_field_automation=[{id,title},...], user_field_value=days
 */
import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useBuilderActions, useBuilderMeta } from '@/features/segments/builder/builder-context';
import { SearchableApiSelect, type SelectOption } from '@/features/segments/builder/searchable-api-select';
import { StepField } from '@/features/segments/builder/interaction-step';

interface AutomationOption {
  id: number;
  name?: string;
  title?: string;
}

function useSearchAutomations(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery({
    queryKey: ['builder-automations', accountId, search],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: AutomationOption[] }>('/automations', {
        params: { page: 1, itemsPerPage: 50, type: 'email', ...(search && { title: search }) },
        signal,
      });
      return data.results ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

const MAX_DAYS = 90;

interface Props {
  data: any;
  cardId: string;
}

export const AutomationAutomationStateStep = memo(function AutomationAutomationStateStep({ data, cardId }: Props) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  // Selected automations (multi-select) — memoized for stable reference
  const selectedAutomations = useMemo<Array<{ id: number; title: string }>>(() => {
    if (Array.isArray(data.user_field_automation)) return data.user_field_automation;
    if (data.user_field_automation && typeof data.user_field_automation === 'object')
      return [data.user_field_automation];
    return [];
  }, [data.user_field_automation]);

  const days = data.user_field_value ?? '0';

  // Search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: automations = [], isLoading } = useSearchAutomations(debouncedSearch);

  const options: SelectOption[] = useMemo(
    () =>
      automations
        .filter((a) => !selectedAutomations.some((s) => s.id === a.id))
        .map((a) => ({ value: String(a.id), label: a.title || a.name || String(a.id) })),
    [automations, selectedAutomations],
  );

  const handleSearchChange = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const update = (field: Record<string, unknown>) => {
    actions.updateStep(cardId, data.id, 'automation_state', {
      user_field_key: 'automation_entry',
      ...field,
    });
  };

  const addAutomation = (automationId: string) => {
    const auto = automations.find((a) => String(a.id) === automationId);
    if (!auto || selectedAutomations.some((s) => s.id === auto.id)) return;
    const updated = [...selectedAutomations, { id: auto.id, title: auto.title || auto.name || '' }];
    update({ user_field_automation: updated, user_field_value: days });
  };

  const removeAutomation = (id: number) => {
    const updated = selectedAutomations.filter((a) => a.id !== id);
    update({ user_field_automation: updated, user_field_value: days });
  };

  const handleDaysChange = (value: string) => {
    const num = Math.min(Number(value) || 0, MAX_DAYS);
    update({ user_field_automation: selectedAutomations, user_field_value: String(num) });
  };

  return (
    <div className="bg-secondary/30 space-y-3 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Automation multi-select */}
        <StepField label={t('automations.editor.automationFilter.filter')}>
          <SearchableApiSelect
            value=""
            onValueChange={addAutomation}
            options={options}
            isLoading={isLoading}
            onSearchChange={handleSearchChange}
            disabled={meta.isDisabled}
            placeholder={t('automations.editor.automationFilter.selectAutomations')}
            className="w-[200px]"
          />
        </StepField>

        {/* Period: last N days */}
        <StepField label={t('automations.editor.automationFilter.period')}>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {t('automations.editor.automationFilter.lastDays')}
            </span>
            <Input
              className="h-8 w-[60px] text-xs"
              type="number"
              min="0"
              max={MAX_DAYS}
              value={days}
              onChange={(e) => handleDaysChange(e.target.value)}
              disabled={meta.isDisabled}
            />
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {t('automations.editor.automationFilter.daysMax', { max: MAX_DAYS })}
            </span>
          </div>
        </StepField>
      </div>

      {/* Selected automations as chips */}
      {selectedAutomations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedAutomations.map((auto) => (
            <Badge key={auto.id} variant="secondary" className="gap-1 pr-1">
              {auto.title}
              <button
                type="button"
                onClick={() => removeAutomation(auto.id)}
                className="hover:text-destructive ml-0.5"
                disabled={meta.isDisabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
});
