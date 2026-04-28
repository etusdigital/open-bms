import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SearchableApiSelect, type SelectOption } from './searchable-api-select';
import { useBuilderMessages } from './use-builder-messages';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import {
  CHANNEL_TYPES,
  ACTIONS_BY_CHANNEL,
  COMPARISON_OPERATORS,
  PERIOD_OPTIONS_BASE,
  PAGE_VIEW_OPERATORS,
  MAX_CUSTOM_DAYS_DEFAULT,
  isNegationAction,
} from './constants';
import type { InteractionStepData } from './types';

interface InteractionStepProps {
  data: InteractionStepData;
  cardId: string;
}

export const InteractionStep = memo(function InteractionStep({ data, cardId }: InteractionStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  const channelType = data.event_type ?? 'email';
  const isAnyChannel = channelType === 'anyChannel';
  const isPageView = channelType === 'page_view';
  const isTriggerContext = meta.context === 'trigger';
  const isNegation = data.conditional_interation === 'not';
  const showActionFields = !isAnyChannel;
  const showMessageField = !isAnyChannel && !isPageView && !isTriggerContext;
  const showOperatorTimes = !isNegation && !isAnyChannel;
  const showPeriod = !isAnyChannel;

  const availableActions = ACTIONS_BY_CHANNEL[channelType] ?? [];

  // Message search (debounced)
  const [messageSearch, setMessageSearch] = useState('');
  const { data: messages = [], isLoading: messagesLoading } = useBuilderMessages(channelType, messageSearch);
  const messageOptions: SelectOption[] = useMemo(
    () => messages.map((m) => ({ value: String(m.id), label: m.title })),
    [messages],
  );
  const currentMessageValue =
    data.message === 'any' ? 'any' : typeof data.message === 'object' && data.message ? String(data.message.id) : '';

  const update = (field: Partial<Omit<InteractionStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'interation', field);
  };

  const handleChannelChange = (value: string) => {
    // Cascade reset is handled by the reducer
    update({ event_type: value });
  };

  const handleActionChange = (value: string) => {
    const negation = isNegationAction(channelType, value);
    update({
      event: value,
      conditional_interation: negation ? 'not' : 'yes',
    });
  };

  const handleTimeChange = (value: string) => {
    if (value === 'custom') {
      update({ time: 'custom', time_custom: data.time_custom ?? 7 });
    } else if (value === 'all') {
      update({ time: 'all' });
    } else {
      update({ time: Number(value) });
    }
  };

  return (
    <div className="bg-secondary/30 space-y-3 rounded-lg p-3">
      {/* Row 1: Type, Action, Message (or Page View), Operator, Times */}
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Channel Type */}
        <StepField label={t('segments.builder.type')}>
          <Select value={channelType} onValueChange={handleChannelChange} disabled={meta.isDisabled}>
            <SelectTrigger size="sm" className="w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_TYPES.map((ch) => (
                <SelectItem key={ch.value} value={ch.value} className="text-xs">
                  {t(ch.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Action */}
        {showActionFields && availableActions.length > 0 && (
          <StepField label={t('segments.builder.action')}>
            <Select value={data.event ?? ''} onValueChange={handleActionChange} disabled={meta.isDisabled}>
              <SelectTrigger size="sm" className="w-[140px] text-xs">
                <SelectValue placeholder={t('common.select', 'Selecionar')} />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map((action) => (
                  <SelectItem key={action.value} value={action.value} className="text-xs">
                    {t(action.labelKey as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StepField>
        )}

        {/* Message (hidden for anyChannel and page_view) */}
        {showMessageField && (
          <StepField label={t('segments.builder.message')}>
            <SearchableApiSelect
              value={currentMessageValue}
              onValueChange={(value) => {
                if (value === 'any') {
                  update({ message: 'any' });
                } else {
                  const msg = messages.find((m) => String(m.id) === value);
                  if (msg) update({ message: { id: msg.id, name: msg.title, title: msg.title } });
                }
              }}
              options={messageOptions}
              isLoading={messagesLoading}
              onSearchChange={setMessageSearch}
              fixedOption={{ value: 'any', label: t('segments.builder.anyMessage') }}
              disabled={meta.isDisabled}
              placeholder={t('segments.builder.message')}
            />
          </StepField>
        )}

        {/* Page View fields (URL operator + URL input) */}
        {isPageView && (
          <StepField label="URL">
            <div className="flex gap-1">
              <Select
                value={data.page_view_filter ?? '='}
                onValueChange={(value) => update({ page_view_filter: value as '=' | 'iLike' })}
                disabled={meta.isDisabled}
              >
                <SelectTrigger size="sm" className="w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_VIEW_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {t(op.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-8 w-[200px] text-xs"
                placeholder="https://..."
                value={data.page_view_value ?? ''}
                onChange={(e) => update({ page_view_value: e.target.value })}
                disabled={meta.isDisabled}
              />
            </div>
          </StepField>
        )}

        {/* Operator + Times (hidden when negation) */}
        {showOperatorTimes && (
          <>
            <StepField label={t('segments.builder.operators.greaterOrEqual', 'É maior ou igual')}>
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

      {/* Row 2: Period */}
      {showPeriod && (
        <div className="border-border/40 flex flex-wrap gap-x-4 gap-y-3 border-t pt-3">
          <StepField label={t('segments.builder.period')}>
            <Select value={String(data.time ?? '')} onValueChange={handleTimeChange} disabled={meta.isDisabled}>
              <SelectTrigger size="sm" className="w-[160px] text-xs">
                <SelectValue placeholder={t('common.select', 'Selecionar')} />
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
        </div>
      )}
    </div>
  );
});

// ─── Shared Layout Helpers ───────────────────────────────────────────────────

export function StepField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase">{label}</div>
      {children}
    </div>
  );
}

export function FieldSeparator() {
  return <div className="bg-border mb-2 hidden h-4 w-px sm:block" />;
}
