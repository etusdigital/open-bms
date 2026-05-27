/**
 * Automation-specific custom field step that adds "Compare 2 fields" mode.
 * Wraps the shared custom field logic with a filter type selector.
 * This mode is only available in automations, not in the segment builder.
 */
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useBuilderActions, useBuilderMeta } from '@/features/segments/builder/builder-context';
import { TEXT_OPERATORS, NUMBER_OPERATORS } from '@/features/segments/builder/constants';
import { SearchableApiSelect, type SelectOption } from '@/features/segments/builder/searchable-api-select';
import { StepField } from '@/features/segments/builder/interaction-step';
import { DatePickerField } from '@/features/segments/builder/date-picker-field';
import type { CustomFieldStepData } from '@/features/segments/builder/types';

interface CustomFieldOption {
  id: number;
  title: string;
  type?: string | null;
}

function useBuilderCustomFields() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery({
    queryKey: ['builder-custom-fields', accountId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: CustomFieldOption[] }>('/custom-fields', {
        params: { itemsPerPage: 200 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

// Operators for compare mode (only =, !=, iLike)
const COMPARE_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '!=', labelKey: 'segments.builder.operators.notEqual' },
  { value: 'iLike', labelKey: 'segments.builder.operators.contains' },
];

interface AutomationCustomFieldStepProps {
  data: CustomFieldStepData;
  cardId: string;
}

export const AutomationCustomFieldStep = memo(function AutomationCustomFieldStep({
  data,
  cardId,
}: AutomationCustomFieldStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();
  const { data: customFields = [], isLoading } = useBuilderCustomFields();

  const filterMode = data.filter_custom_field ?? 'text';
  const isCompareMode = filterMode === 'compare_fields';
  const fieldType = data.custom_field_type ?? 'text';

  const operatorOptions = isCompareMode
    ? COMPARE_OPERATORS
    : fieldType === 'number' || fieldType === 'date'
      ? NUMBER_OPERATORS
      : TEXT_OPERATORS;

  const fieldOptions: SelectOption[] = useMemo(
    () => customFields.map((f) => ({ value: String(f.id), label: f.title })),
    [customFields],
  );

  // Second field options: exclude the first selected field
  const field2Options: SelectOption[] = useMemo(
    () =>
      customFields
        .filter((f) => String(f.id) !== String(data.custom_field_id))
        .map((f) => ({ value: f.title, label: f.title })),
    [customFields, data.custom_field_id],
  );

  const update = (field: Partial<Omit<CustomFieldStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'custom_field', field);
  };

  const handleFieldSelect = (value: string) => {
    const field = customFields.find((f) => String(f.id) === value);
    if (field) {
      update({
        custom_field_id: field.id,
        custom_field_name: field.title,
        custom_field_type: field.type ?? 'text',
        conditional_custom_field: '=',
        custom_field_value: null,
        custom_field_name_2: null,
      });
    }
  };

  const handleFilterModeChange = (mode: string) => {
    update({
      filter_custom_field: mode,
      custom_field_value: null,
      custom_field_name_2: null,
      conditional_custom_field: '=',
    });
  };

  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Filter type select (automations only) */}
        <StepField label={t('automations.editor.conditions.filterType')}>
          <Select value={filterMode} onValueChange={handleFilterModeChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text" className="text-xs">
                {t('automations.editor.conditions.fieldValue')}
              </SelectItem>
              <SelectItem value="compare_fields" className="text-xs">
                {t('automations.editor.conditions.compareFields')}
              </SelectItem>
            </SelectContent>
          </Select>
        </StepField>

        {/* Field select */}
        <StepField label={t('segments.builder.field')}>
          <SearchableApiSelect
            value={data.custom_field_id ? String(data.custom_field_id) : ''}
            onValueChange={handleFieldSelect}
            options={fieldOptions}
            isLoading={isLoading}
            disabled={meta.isDisabled}
            placeholder={t('common.select', 'Selecionar')}
          />
        </StepField>

        {/* Operator */}
        {data.custom_field_id && (
          <>
            <StepField label={t('segments.builder.filter')}>
              <Select
                value={data.conditional_custom_field ?? '='}
                onValueChange={(value) => update({ conditional_custom_field: value })}
                disabled={meta.isDisabled}
              >
                <SelectTrigger size="sm" className="w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operatorOptions.map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {t(op.labelKey as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StepField>

            {/* Value OR second field */}
            {isCompareMode ? (
              <StepField label={t('automations.editor.conditions.field2')}>
                <SearchableApiSelect
                  value={data.custom_field_name_2 ?? ''}
                  onValueChange={(value) => update({ custom_field_name_2: value })}
                  options={field2Options}
                  isLoading={isLoading}
                  disabled={meta.isDisabled}
                  placeholder={t('common.select', 'Selecionar')}
                />
              </StepField>
            ) : (
              <StepField label={t('segments.builder.value')}>
                {fieldType === 'date' ? (
                  <DatePickerField
                    value={data.custom_field_value ? String(data.custom_field_value) : null}
                    onChange={(value) => update({ custom_field_value: value })}
                    disabled={meta.isDisabled}
                  />
                ) : fieldType === 'number' ? (
                  <Input
                    className="h-8 w-[120px] text-xs"
                    type="number"
                    value={data.custom_field_value ?? ''}
                    onChange={(e) => update({ custom_field_value: Number(e.target.value) })}
                    disabled={meta.isDisabled}
                  />
                ) : (
                  <Input
                    className="h-8 w-[180px] text-xs"
                    value={String(data.custom_field_value ?? '')}
                    onChange={(e) => update({ custom_field_value: e.target.value })}
                    disabled={meta.isDisabled}
                  />
                )}
              </StepField>
            )}
          </>
        )}
      </div>
    </div>
  );
});
