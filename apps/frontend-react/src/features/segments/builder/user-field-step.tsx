import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import {
  USER_FIELDS,
  USER_FIELD_ENTRY_OPERATORS,
  EQUAL_NOT_EQUAL_OPERATORS,
  HAS_NOT_HAS_OPERATORS,
  YES_NO_OPERATORS,
  EMAIL_PROVIDERS,
  COMMUNICATION_CHANNELS,
  VERTICAL_TYPES,
} from './constants';
import { StepField } from './interaction-step';
import { DatePickerField } from './date-picker-field';
import type { UserFieldStepData } from './types';

interface UserFieldStepProps {
  data: UserFieldStepData;
  cardId: string;
}

export const UserFieldStep = memo(function UserFieldStep({ data, cardId }: UserFieldStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const fieldKey = data.user_field_key ?? '';

  const update = (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'user_field', field);
  };

  const handleFieldChange = (value: string) => {
    // Reset filter values when field changes
    update({
      user_field_key: value,
      conditional_user_field: null,
      user_field_value: null,
    });
  };

  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Field select */}
        <StepField label={t('segments.builder.field')}>
          <Select value={fieldKey} onValueChange={handleFieldChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[180px] text-xs">
              <SelectValue placeholder={t('common.select', 'Selecionar')} />
            </SelectTrigger>
            <SelectContent>
              {USER_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {t(f.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Sub-component per field type */}
        {fieldKey && (
          <>
            <UserFieldFilter fieldKey={fieldKey} data={data} update={update} disabled={meta.isDisabled} />
          </>
        )}
      </div>
    </div>
  );
});

// ─── Field-specific sub-components (inline) ──────────────────────────────────

function UserFieldFilter({
  fieldKey,
  data,
  update,
  disabled,
}: {
  fieldKey: string;
  data: UserFieldStepData;
  update: (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => void;
  disabled: boolean;
}) {
  switch (fieldKey) {
    case 'created_at_date':
    case 'last_automation_date':
      return <EntryField data={data} update={update} disabled={disabled} />;
    case 'email_provider':
      return <EmailProviderField data={data} update={update} disabled={disabled} />;
    case 'communication_channels':
      return <CommunicationChannelsField data={data} update={update} disabled={disabled} />;
    case 'last_vertical_type':
      return <VerticalTypeField data={data} update={update} disabled={disabled} />;
    case 'is_email_deliverable':
      return <BooleanField data={data} update={update} disabled={disabled} />;
    default:
      return null;
  }
}

// ─── Entry / Automation Entry ────────────────────────────────────────────────

function EntryField({
  data,
  update,
  disabled,
}: {
  data: UserFieldStepData;
  update: (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const operator = data.conditional_user_field ?? '=';
  const isLastDays = operator === '-';

  return (
    <>
      <StepField label={t('segments.builder.filter')}>
        <Select
          value={operator}
          onValueChange={(value) => {
            update({ conditional_user_field: value, user_field_value: null });
          }}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_FIELD_ENTRY_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {t(op.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>

      <StepField label={t('segments.builder.value')}>
        {isLastDays ? (
          <Input
            className="h-8 w-[100px] text-xs"
            type="number"
            min="0"
            placeholder="0 = hoje"
            value={data.user_field_value != null ? String(data.user_field_value) : ''}
            onChange={(e) => update({ user_field_value: Number(e.target.value) })}
            disabled={disabled}
          />
        ) : (
          <DatePickerField
            value={data.user_field_value ? String(data.user_field_value) : null}
            onChange={(value) => update({ user_field_value: value })}
            disabled={disabled}
          />
        )}
      </StepField>
    </>
  );
}

// ─── Email Provider ──────────────────────────────────────────────────────────

function EmailProviderField({
  data,
  update,
  disabled,
}: {
  data: UserFieldStepData;
  update: (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <StepField label={t('segments.builder.filter')}>
        <Select
          value={data.conditional_user_field ?? '='}
          onValueChange={(value) => update({ conditional_user_field: value })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EQUAL_NOT_EQUAL_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {t(op.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>

      <StepField label={t('segments.builder.value')}>
        <Select
          value={String(data.user_field_value ?? '')}
          onValueChange={(value) => update({ user_field_value: value })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[160px] text-xs">
            <SelectValue placeholder={t('common.select', 'Selecionar')} />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {t(p.labelKey, p.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>
    </>
  );
}

// ─── Communication Channels ──────────────────────────────────────────────────

function CommunicationChannelsField({
  data,
  update,
  disabled,
}: {
  data: UserFieldStepData;
  update: (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <StepField label={t('segments.builder.filter')}>
        <Select
          value={data.conditional_user_field ?? 'true'}
          onValueChange={(value) => update({ conditional_user_field: value })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HAS_NOT_HAS_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {t(op.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>

      <StepField label={t('segments.builder.value')}>
        <Select
          value={String(data.user_field_value ?? '')}
          onValueChange={(value) => update({ user_field_value: value })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[140px] text-xs">
            <SelectValue placeholder={t('common.select', 'Selecionar')} />
          </SelectTrigger>
          <SelectContent>
            {COMMUNICATION_CHANNELS.map((ch) => (
              <SelectItem key={ch.value} value={ch.value} className="text-xs">
                {t(ch.labelKey, ch.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>
    </>
  );
}

// ─── Vertical Type ───────────────────────────────────────────────────────────

function VerticalTypeField({
  data,
  update,
  disabled,
}: {
  data: UserFieldStepData;
  update: (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <StepField label={t('segments.builder.filter')}>
        <Select
          value={data.conditional_user_field ?? '='}
          onValueChange={(value) => update({ conditional_user_field: value })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EQUAL_NOT_EQUAL_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {t(op.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>

      <StepField label={t('segments.builder.value')}>
        <Select
          value={String(data.user_field_value ?? '')}
          onValueChange={(value) => update({ user_field_value: value })}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="w-[160px] text-xs">
            <SelectValue placeholder={t('common.select', 'Selecionar')} />
          </SelectTrigger>
          <SelectContent>
            {VERTICAL_TYPES.map((vt) => (
              <SelectItem key={vt.value} value={vt.value} className="text-xs">
                {t(vt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StepField>
    </>
  );
}

// ─── Boolean (email deliverable) ─────────────────────────────────────────────

function BooleanField({
  data,
  update,
  disabled,
}: {
  data: UserFieldStepData;
  update: (field: Partial<Omit<UserFieldStepData, 'type' | 'id' | 'stepConnector'>>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <StepField label={t('segments.builder.value')}>
      <Select
        value={data.conditional_user_field ?? 'true'}
        onValueChange={(value) => update({ conditional_user_field: value })}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YES_NO_OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {t(op.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </StepField>
  );
}
