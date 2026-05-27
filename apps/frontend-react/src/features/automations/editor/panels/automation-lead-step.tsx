/**
 * Lead data conditional step for automations.
 * Allows filtering by lead fields: campaign_id, engaged, lead_source,
 * utm_source, status, utm_campaign.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useBuilderActions, useBuilderMeta } from '@/features/segments/builder/builder-context';
import { StepField } from '@/features/segments/builder/interaction-step';

// ---------------------------------------------------------------------------
// Lead field definitions
// ---------------------------------------------------------------------------

const LEAD_FIELDS = [
  { value: 'campaign_id', labelKey: 'automations.editor.lead.campaignId' },
  { value: 'engaged', labelKey: 'automations.editor.lead.engaged' },
  { value: 'lead_source', labelKey: 'automations.editor.lead.leadSource' },
  { value: 'utm_source', labelKey: 'automations.editor.lead.utmSource' },
  { value: 'status', labelKey: 'automations.editor.lead.status' },
  { value: 'utm_campaign', labelKey: 'automations.editor.lead.utmCampaign' },
] as const;

const OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '!=', labelKey: 'segments.builder.operators.notEqual' },
] as const;

// Predefined value options per field
const FIELD_VALUES: Record<string, Array<{ value: string; labelKey: string }>> = {
  engaged: [
    { value: '-30', labelKey: 'automations.editor.lead.neverEngaged30' },
    { value: '-15', labelKey: 'automations.editor.lead.neverEngaged15' },
    { value: '-3', labelKey: 'automations.editor.lead.neverEngaged3' },
    { value: '-1', labelKey: 'automations.editor.lead.neverEngaged1' },
    { value: '3', labelKey: 'automations.editor.lead.engaged3' },
    { value: '7', labelKey: 'automations.editor.lead.engaged7' },
    { value: '15', labelKey: 'automations.editor.lead.engaged15' },
    { value: '30', labelKey: 'automations.editor.lead.engaged30' },
    { value: '40', labelKey: 'automations.editor.lead.engaged40' },
  ],
  utm_source: [
    { value: 'google', labelKey: 'Google' },
    { value: 'facebook', labelKey: 'Facebook' },
    { value: 'tiktok', labelKey: 'Tiktok' },
    { value: 'whatsapp', labelKey: 'Whatsapp' },
  ],
  status: [
    { value: 'old', labelKey: 'automations.editor.lead.old' },
    { value: 'new', labelKey: 'automations.editor.lead.new' },
  ],
  lead_source: [
    { value: 'quizmaker', labelKey: 'quizmaker' },
    { value: 'api', labelKey: 'api' },
  ],
};

// Fields that use free text input instead of dropdown
const FREE_TEXT_FIELDS = new Set(['campaign_id', 'utm_campaign']);

// ---------------------------------------------------------------------------
// Step data shape (stored in the builder state)
// ---------------------------------------------------------------------------

interface LeadStepData {
  id: string;
  type: 'lead';
  stepConnector?: 'and' | 'or';
  lead_field_key?: string | null;
  conditional_lead_field?: string | null;
  lead_field_value?: string | null;
}

interface Props {
  data: LeadStepData;
  cardId: string;
}

export const AutomationLeadStep = memo(function AutomationLeadStep({ data, cardId }: Props) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const selectedField = data.lead_field_key ?? '';
  const isEngaged = selectedField === 'engaged';
  const isFreeText = FREE_TEXT_FIELDS.has(selectedField);
  const valueOptions = FIELD_VALUES[selectedField] ?? [];
  const hasDropdown = valueOptions.length > 0;

  const update = (field: Partial<Omit<LeadStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'lead' as any, field);
  };

  const handleFieldChange = (value: string) => {
    update({
      lead_field_key: value,
      conditional_lead_field: '=',
      lead_field_value: null,
    });
  };

  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Field selector */}
        <StepField label={t('automations.editor.lead.field')}>
          <Select value={selectedField} onValueChange={handleFieldChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[160px] text-xs">
              <SelectValue placeholder={t('common.select', 'Selecionar')} />
            </SelectTrigger>
            <SelectContent>
              {LEAD_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {t(f.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Operator (hidden for engaged) */}
        {selectedField && !isEngaged && (
          <StepField label={t('segments.builder.filter')}>
            <Select
              value={data.conditional_lead_field ?? '='}
              onValueChange={(value) => update({ conditional_lead_field: value })}
              disabled={meta.isDisabled}
            >
              <SelectTrigger size="sm" className="w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">
                    {t(op.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StepField>
        )}

        {/* Value */}
        {selectedField && (
          <StepField label={t('segments.builder.value')}>
            {isFreeText ? (
              <Input
                className="h-8 w-[180px] text-xs"
                value={data.lead_field_value ?? ''}
                onChange={(e) => update({ lead_field_value: e.target.value })}
                disabled={meta.isDisabled}
                placeholder={t('automations.editor.lead.enterValue')}
              />
            ) : hasDropdown ? (
              <Select
                value={data.lead_field_value ?? ''}
                onValueChange={(value) => update({ lead_field_value: value })}
                disabled={meta.isDisabled}
              >
                <SelectTrigger size="sm" className="w-[220px] text-xs">
                  <SelectValue placeholder={t('common.select', 'Selecionar')} />
                </SelectTrigger>
                <SelectContent>
                  {valueOptions.map((v) => (
                    <SelectItem key={v.value} value={v.value} className="text-xs">
                      {v.labelKey.startsWith('automations.') ? t(v.labelKey as never) : v.labelKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </StepField>
        )}
      </div>
    </div>
  );
});
