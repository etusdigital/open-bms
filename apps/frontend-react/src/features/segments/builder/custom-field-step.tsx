import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import { TEXT_OPERATORS, NUMBER_OPERATORS } from './constants';
import { SearchableApiSelect, type SelectOption } from './searchable-api-select';
import { StepField } from './interaction-step';
import { DatePickerField } from './date-picker-field';
import type { CustomFieldStepData } from './types';

interface CustomFieldOption {
  id: number;
  title: string;
  type?: string | null;
  decimalLength?: number | null;
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

interface CustomFieldStepProps {
  data: CustomFieldStepData;
  cardId: string;
}

export const CustomFieldStep = memo(function CustomFieldStep({ data, cardId }: CustomFieldStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();
  const { data: customFields = [], isLoading } = useBuilderCustomFields();

  const fieldType = data.custom_field_type ?? 'text';

  const operatorOptions = fieldType === 'number' || fieldType === 'date' ? NUMBER_OPERATORS : TEXT_OPERATORS;

  const fieldOptions: SelectOption[] = useMemo(
    () => customFields.map((f) => ({ value: String(f.id), label: f.title })),
    [customFields],
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
      });
    }
  };

  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
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
                      {t(op.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StepField>

            {/* Value */}
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
          </>
        )}
      </div>
    </div>
  );
});
