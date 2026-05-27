/**
 * Automation-specific interaction step.
 * Same as the segment builder's InteractionStep but without
 * "Any channel" and "Website" (page_view) options.
 */
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useBuilderActions, useBuilderMeta } from '@/features/segments/builder/builder-context';
import { CHANNEL_TYPES, PERIOD_OPTIONS_BASE } from '@/features/segments/builder/constants';
import { StepField } from '@/features/segments/builder/interaction-step';
import type { InteractionStepData } from '@/features/segments/builder/types';

// Filter out anyChannel and page_view for automations
const AUTOMATION_CHANNEL_TYPES = CHANNEL_TYPES.filter((ch) => ch.value !== 'anyChannel' && ch.value !== 'page_view');

// ---------------------------------------------------------------------------
// Automation-specific actions per channel
// Labels use "Sent/Not sent" instead of "Received/Not received"
// Push channels include delivered/nodelivered (missing from segment builder)
// ---------------------------------------------------------------------------

interface ActionOption {
  value: string;
  labelKey: string;
  dbField: string;
  isNegation: boolean;
}

const emailActions: ActionOption[] = [
  {
    value: 'open',
    labelKey: 'automations.editor.interactions.open',
    dbField: 'last_open_date',
    isNegation: false,
  },
  {
    value: 'noopen',
    labelKey: 'automations.editor.interactions.noopen',
    dbField: 'last_open_date',
    isNegation: true,
  },
  {
    value: 'click',
    labelKey: 'automations.editor.interactions.click',
    dbField: 'last_click_date',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'automations.editor.interactions.noclick',
    dbField: 'last_click_date',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'automations.editor.interactions.sent',
    dbField: 'last_sent_date',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'automations.editor.interactions.nosent',
    dbField: 'last_sent_date',
    isNegation: true,
  },
];

const pushActions: ActionOption[] = [
  {
    value: 'click',
    labelKey: 'automations.editor.interactions.click',
    dbField: 'last_click_date',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'automations.editor.interactions.noclick',
    dbField: 'last_click_date',
    isNegation: true,
  },
  {
    value: 'delivered',
    labelKey: 'automations.editor.interactions.delivered',
    dbField: 'last_delivered_date',
    isNegation: false,
  },
  {
    value: 'nodelivered',
    labelKey: 'automations.editor.interactions.nodelivered',
    dbField: 'last_delivered_date',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'automations.editor.interactions.sent',
    dbField: 'last_sent_date',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'automations.editor.interactions.nosent',
    dbField: 'last_sent_date',
    isNegation: true,
  },
];

const smsActions: ActionOption[] = [
  {
    value: 'delivered',
    labelKey: 'automations.editor.interactions.delivered',
    dbField: 'sms_last_delivered',
    isNegation: false,
  },
  {
    value: 'nodelivered',
    labelKey: 'automations.editor.interactions.nodelivered',
    dbField: 'sms_last_delivered',
    isNegation: true,
  },
  {
    value: 'click',
    labelKey: 'automations.editor.interactions.click',
    dbField: 'sms_last_click',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'automations.editor.interactions.noclick',
    dbField: 'sms_last_click',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'automations.editor.interactions.sent',
    dbField: 'sms_last_sent',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'automations.editor.interactions.nosent',
    dbField: 'sms_last_sent',
    isNegation: true,
  },
];

const whatsappActions: ActionOption[] = [
  {
    value: 'open',
    labelKey: 'automations.editor.interactions.open',
    dbField: 'whatsapp_last_open',
    isNegation: false,
  },
  {
    value: 'noopen',
    labelKey: 'automations.editor.interactions.noopen',
    dbField: 'whatsapp_last_open',
    isNegation: true,
  },
  {
    value: 'delivered',
    labelKey: 'automations.editor.interactions.delivered',
    dbField: 'whatsapp_last_delivered',
    isNegation: false,
  },
  {
    value: 'nodelivered',
    labelKey: 'automations.editor.interactions.nodelivered',
    dbField: 'whatsapp_last_delivered',
    isNegation: true,
  },
  {
    value: 'click',
    labelKey: 'automations.editor.interactions.click',
    dbField: 'whatsapp_last_click',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'automations.editor.interactions.noclick',
    dbField: 'whatsapp_last_click',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'automations.editor.interactions.sent',
    dbField: 'whatsapp_last_sent',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'automations.editor.interactions.nosent',
    dbField: 'whatsapp_last_sent',
    isNegation: true,
  },
];

const AUTOMATION_ACTIONS_BY_CHANNEL: Record<string, ActionOption[]> = {
  email: emailActions,
  'web-push': pushActions,
  'mobile-push': pushActions,
  sms: smsActions,
  whatsapp: whatsappActions,
};

interface Props {
  data: InteractionStepData;
  cardId: string;
}

export const AutomationInteractionStep = memo(function AutomationInteractionStep({ data, cardId }: Props) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const channelType = data.event_type ?? 'email';
  const availableActions = useMemo(() => AUTOMATION_ACTIONS_BY_CHANNEL[channelType] ?? [], [channelType]);

  const update = (field: Partial<Omit<InteractionStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'interation', field);
  };

  const handleChannelChange = (value: string) => {
    update({
      event_type: value,
      event: undefined,
      conditional_interation: 'yes',
      time: 0,
      time_custom: null,
    });
  };

  const handleActionChange = (value: string) => {
    const action = availableActions.find((a) => a.value === value);
    if (action) {
      update({
        event: value,
        conditional_interation: action.isNegation ? 'not' : 'yes',
      });
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === 'custom') {
      update({ time: 'custom' as any, time_custom: data.time_custom ?? 30 });
    } else {
      update({ time: value === 'all' ? value : Number(value), time_custom: null });
    }
  };

  return (
    <div className="bg-secondary/30 space-y-3 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Channel Type — filtered for automations */}
        <StepField label={t('segments.builder.type')}>
          <Select value={channelType} onValueChange={handleChannelChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTOMATION_CHANNEL_TYPES.map((ch) => (
                <SelectItem key={ch.value} value={ch.value} className="text-xs">
                  {t(ch.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Action */}
        {availableActions.length > 0 && (
          <StepField label={t('segments.builder.action')}>
            <Select value={data.event ?? ''} onValueChange={handleActionChange} disabled={meta.isDisabled}>
              <SelectTrigger size="sm" className="w-[140px] text-xs">
                <SelectValue placeholder={t('common.select', 'Selecionar')} />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    {t(a.labelKey as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StepField>
        )}
      </div>

      {/* Row 2: Period */}
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        <StepField label={t('segments.builder.period')}>
          <Select
            value={data.time === 'custom' ? 'custom' : String(data.time ?? 0)}
            onValueChange={handlePeriodChange}
            disabled={meta.isDisabled}
          >
            <SelectTrigger size="sm" className="w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS_BASE.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {t(p.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {data.time === 'custom' && (
          <StepField label={t('segments.builder.days')}>
            <Input
              className="h-8 w-[80px] text-xs"
              type="number"
              min={1}
              max={180}
              value={data.time_custom ?? ''}
              onChange={(e) => update({ time_custom: Number(e.target.value) || null })}
              disabled={meta.isDisabled}
            />
          </StepField>
        )}
      </div>
    </div>
  );
});
