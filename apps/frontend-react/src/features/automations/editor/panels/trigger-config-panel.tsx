/**
 * Full trigger configuration panel.
 * Matches the Vue 2 TriggerComponent with:
 * - 5 trigger types with type-specific sub-fields
 * - Entry frequency (applyFrequency) with period config
 * - Entry condition filter (conditional builder)
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableApiSelect, type SelectOption } from '@/features/segments/builder/searchable-api-select';
import { BuilderProvider } from '@/features/segments/builder/builder-context';
import { parseSteps, serializeSteps } from '@/features/segments/builder/builder-serializer';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { AutomationConditionBuilder } from './automation-condition-builder';
import type { TriggerNodeData, TriggerSettings, ConditionalRule } from '../types';
import type { BuilderState, BuilderCard, StepType } from '@/features/segments/builder/types';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useTags(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery<{ results: Array<{ id: number; name: string }> }>({
    queryKey: ['tags', 'trigger-select', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/tags', {
        params: { type: 'tag', page: 1, itemsPerPage: 40, ...(search && { title: search }) },
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

function useEmailMessages(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery<{ results: Array<{ id: number; name: string; title: string }> }>({
    queryKey: ['messages', 'trigger-email-select', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/messages', {
        params: { type: 'email', page: 1, itemsPerPage: 10, ...(search && { title: search }) },
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

function useCustomEvents(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery<{ results: Array<{ id: number; name: string }> }>({
    queryKey: ['custom-events', 'trigger-select', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/custom-events', {
        params: { page: 1, itemsPerPage: 20, ...(search && { title: search }) },
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_TYPES = [
  { value: 'tag', labelKey: 'automations.editor.trigger.typeTag' },
  { value: 'events', labelKey: 'automations.editor.trigger.typeEvents' },
  { value: 'custom_events', labelKey: 'automations.editor.trigger.typeCustomEvents' },
  { value: 'web-push', labelKey: 'automations.editor.trigger.typeWebPush' },
  { value: 'mobile-push', labelKey: 'automations.editor.trigger.typeMobilePush' },
] as const;

const EVENT_TYPES = [
  { value: 'open', labelKey: 'automations.editor.trigger.eventOpen' },
  { value: 'click', labelKey: 'automations.editor.trigger.eventClick' },
  { value: 'first_open_30_days', labelKey: 'automations.editor.trigger.eventFirstOpen30' },
] as const;

const FREQUENCY_OPTIONS = [
  { value: 'unique', labelKey: 'automations.editor.trigger.onlyOnce' },
  { value: 'multiply-period', labelKey: 'automations.editor.trigger.onceDuringPeriod' },
  { value: 'multiply', labelKey: 'automations.editor.trigger.multipleTimes' },
] as const;

const TIME_UNITS = [
  { value: 'days', labelKey: 'automations.editor.trigger.days' },
  { value: 'hours', labelKey: 'automations.editor.trigger.hours' },
  { value: 'minutes', labelKey: 'automations.editor.trigger.minutes' },
] as const;

const AUTOMATION_CONDITION_STEP_TYPES: StepType[] = [
  'interation',
  'custom_field',
  'user_field',
  'tag',
  'automation_state',
  'custom_event',
  'lead',
];

// ---------------------------------------------------------------------------
// Period conversion (stored in minutes)
// ---------------------------------------------------------------------------

function toDisplayPeriod(minutes: number, unit: string): number {
  if (unit === 'days') return Math.round(minutes / (24 * 60));
  if (unit === 'hours') return Math.round(minutes / 60);
  return minutes;
}

function toMinutes(value: number, unit: string): number {
  if (unit === 'days') return value * 24 * 60;
  if (unit === 'hours') return value * 60;
  return value;
}

// ---------------------------------------------------------------------------
// Conditional helpers
// ---------------------------------------------------------------------------

function rulesToCards(rules: ConditionalRule[]): BuilderCard[] {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return [{ id: crypto.randomUUID(), steps: [] }];
  }
  return parseSteps([rules]);
}

function cardsToRules(cards: BuilderCard[]): ConditionalRule[] {
  const serialized = serializeSteps(cards);
  if (serialized.length === 0) return [];
  return serialized[0] as ConditionalRule[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TriggerConfigPanelProps {
  data: TriggerNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}

export function TriggerConfigPanel({ data, onSave, onClose }: TriggerConfigPanelProps) {
  const { t } = useTranslation();

  // Current settings state
  const [triggerType, setTriggerType] = useState(data.settings.type ?? '');
  const [tagId, setTagId] = useState(data.settings.id ? String(data.settings.id) : '');
  const [tagName, setTagName] = useState(data.settings.name ?? '');
  const [eventType, setEventType] = useState<string>(data.settings.eventType ?? 'open');
  const [messageId, setMessageId] = useState(data.settings.id ? String(data.settings.id) : '');
  const [messageTitle, setMessageTitle] = useState(data.settings.title ?? '');
  const [customEventId, setCustomEventId] = useState(data.settings.id ? String(data.settings.id) : '');
  const [customEventName, setCustomEventName] = useState(data.settings.name ?? '');

  // Frequency
  const [applyFrequency, setApplyFrequency] = useState(data.settings.applyFrequency ?? 'unique');
  const [typeMultiply, setTypeMultiply] = useState<string>(data.settings.typeMultiply ?? 'days');
  const [periodDisplay, setPeriodDisplay] = useState(
    toDisplayPeriod(data.settings.timePeriod ?? 0, data.settings.typeMultiply ?? 'days'),
  );

  // Conditional
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>(data.settings.conditional ?? []);

  // Debounced search states
  const [_tagSearch, _setTagSearch] = useState('');
  const [_msgSearch, _setMsgSearch] = useState('');
  const [_ceSearch, _setCeSearch] = useState('');
  const tagDebounce = useRef<ReturnType<typeof setTimeout>>(null);
  const msgDebounce = useRef<ReturnType<typeof setTimeout>>(null);
  const ceDebounce = useRef<ReturnType<typeof setTimeout>>(null);
  const [debouncedTagSearch, setDebouncedTagSearch] = useState('');
  const [debouncedMsgSearch, setDebouncedMsgSearch] = useState('');
  const [debouncedCeSearch, setDebouncedCeSearch] = useState('');

  useEffect(
    () => () => {
      if (tagDebounce.current) clearTimeout(tagDebounce.current);
      if (msgDebounce.current) clearTimeout(msgDebounce.current);
      if (ceDebounce.current) clearTimeout(ceDebounce.current);
    },
    [],
  );

  const debounceTag = useCallback((s: string) => {
    if (tagDebounce.current) clearTimeout(tagDebounce.current);
    tagDebounce.current = setTimeout(() => setDebouncedTagSearch(s), 300);
  }, []);
  const debounceMsg = useCallback((s: string) => {
    if (msgDebounce.current) clearTimeout(msgDebounce.current);
    msgDebounce.current = setTimeout(() => setDebouncedMsgSearch(s), 300);
  }, []);
  const debounce_ce = useCallback((s: string) => {
    if (ceDebounce.current) clearTimeout(ceDebounce.current);
    ceDebounce.current = setTimeout(() => setDebouncedCeSearch(s), 300);
  }, []);

  // API queries
  const { data: tagsRes, isLoading: tagsLoading } = useTags(debouncedTagSearch);
  const { data: msgsRes, isLoading: msgsLoading } = useEmailMessages(debouncedMsgSearch);
  const { data: ceRes, isLoading: ceLoading } = useCustomEvents(debouncedCeSearch);

  const tagOptions: SelectOption[] = useMemo(() => {
    const items = (tagsRes?.results ?? []).map((t) => ({ value: String(t.id), label: t.name }));
    // Ensure the currently selected tag is always in the list
    if (tagId && tagName && !items.find((o) => o.value === tagId)) {
      items.unshift({ value: tagId, label: tagName });
    }
    return items;
  }, [tagsRes, tagId, tagName]);

  const msgOptions: SelectOption[] = useMemo(() => {
    const items = (msgsRes?.results ?? []).map((m) => ({
      value: String(m.id),
      label: m.title || m.name,
    }));
    // Ensure the currently selected message is always in the list
    if (messageId && messageId !== '0' && messageTitle && !items.find((o) => o.value === messageId)) {
      items.unshift({ value: messageId, label: messageTitle });
    }
    return [{ value: '0', label: t('automations.editor.trigger.anyMessage') }, ...items];
  }, [msgsRes, messageId, messageTitle, t]);

  const ceOptions: SelectOption[] = useMemo(() => {
    const items = (ceRes?.results ?? []).map((e) => ({ value: String(e.id), label: e.name }));
    // Ensure the currently selected custom event is always in the list
    if (customEventId && customEventName && !items.find((o) => o.value === customEventId)) {
      items.unshift({ value: customEventId, label: customEventName });
    }
    return items;
  }, [ceRes, customEventId, customEventName]);

  // Persist to parent
  const persist = useCallback(
    (overrides?: Partial<TriggerSettings>) => {
      const currentType = (overrides?.type ?? triggerType) as TriggerSettings['type'];
      const currentFrequency = (overrides?.applyFrequency ?? applyFrequency) as TriggerSettings['applyFrequency'];
      const currentTimePeriod = overrides?.timePeriod ?? toMinutes(periodDisplay, typeMultiply || 'days');
      const currentTypeMultiply = (overrides?.typeMultiply ?? typeMultiply) as TriggerSettings['typeMultiply'];
      const rules = overrides?.conditional ?? conditionalRules;

      // Build only the properties the schema allows (additionalProperties: false)
      const settings: Record<string, unknown> = {
        type: currentType || undefined,
        applyFrequency: currentFrequency || 'unique',
        timePeriod: currentTimePeriod || 0,
        typeMultiply: currentTypeMultiply ?? '',
      };

      // Only include conditional when there are actual rules (schema: minItems: 1)
      if (rules && rules.length > 0) {
        settings.conditional = rules;
      }

      const type = currentType;
      if (type === 'tag') {
        settings.id = overrides?.id ?? (Number(tagId) || 0);
        settings.name = overrides?.name ?? tagName;
      } else if (type === 'events') {
        const evtType = (overrides?.eventType ?? eventType) as TriggerSettings['eventType'];
        settings.eventType = evtType;
        if (evtType === 'first_open_30_days') {
          settings.id = 0;
        } else {
          settings.id = overrides?.id ?? (Number(messageId) || 0);
          settings.name = overrides?.name ?? '';
          settings.title = overrides?.title ?? messageTitle;
        }
      } else if (type === 'custom_events') {
        settings.id = overrides?.id ?? (Number(customEventId) || 0);
        settings.name = overrides?.name ?? customEventName;
      } else if (type === 'web-push' || type === 'mobile-push') {
        settings.id = 0;
      } else {
        // No type selected yet — set defaults for required fields
        settings.id = 0;
      }

      onSave(settings);
    },
    [
      triggerType,
      tagId,
      tagName,
      eventType,
      messageId,
      messageTitle,
      customEventId,
      customEventName,
      applyFrequency,
      typeMultiply,
      periodDisplay,
      conditionalRules,
      onSave,
    ],
  );

  // Conditional builder state sync (deferred to avoid render-during-render)
  const conditionInitialCards = useMemo(
    () => rulesToCards(data.settings.conditional ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const pendingCondRef = useRef<BuilderState | null>(null);
  const rafRef = useRef<number>(0);
  const handleConditionChange = useCallback(
    (state: BuilderState) => {
      pendingCondRef.current = state;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!pendingCondRef.current) return;
        const rules = cardsToRules(pendingCondRef.current.cards);
        setConditionalRules(rules);
        persist({ conditional: rules });
      });
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div className="space-y-5">
      {/* Section 1: Trigger type */}
      <div className="space-y-2">
        <Label>{t('automations.editor.trigger.selectType')}</Label>
        <Select
          value={triggerType}
          onValueChange={(v) => {
            setTriggerType(v);
            persist({ type: v as TriggerSettings['type'] });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('automations.editor.trigger.selectTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((tt) => (
              <SelectItem key={tt.value} value={tt.value}>
                {t(tt.labelKey as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Section 2: Type-specific sub-fields */}
      {triggerType === 'tag' && (
        <div className="space-y-2">
          <Label>{t('automations.editor.trigger.tag')}</Label>
          <SearchableApiSelect
            value={tagId}
            onValueChange={(v) => {
              const tag = tagsRes?.results?.find((t) => String(t.id) === v);
              if (tag) {
                setTagId(String(tag.id));
                setTagName(tag.name);
                persist({ id: tag.id, name: tag.name });
              }
            }}
            options={tagOptions}
            isLoading={tagsLoading}
            onSearchChange={debounceTag}
            placeholder={t('automations.editor.trigger.selectTag')}
            className="h-9 w-full text-sm"
            popoverClassName="w-[var(--radix-popover-trigger-width)]"
          />
        </div>
      )}

      {triggerType === 'events' && (
        <>
          <div className="space-y-2">
            <Label>{t('automations.editor.trigger.eventType')}</Label>
            <Select
              value={eventType}
              onValueChange={(v) => {
                setEventType(v);
                if (v === 'first_open_30_days') {
                  persist({ eventType: v as TriggerSettings['eventType'], id: 0 });
                } else {
                  persist({ eventType: v as TriggerSettings['eventType'] });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((et) => (
                  <SelectItem key={et.value} value={et.value}>
                    {t(et.labelKey as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {eventType !== 'first_open_30_days' && (
            <div className="space-y-2">
              <Label>{t('automations.editor.trigger.message')}</Label>
              <SearchableApiSelect
                value={messageId}
                onValueChange={(v) => {
                  const msg = (msgsRes?.results ?? []).find((m) => String(m.id) === v);
                  setMessageId(v);
                  setMessageTitle(msg?.title ?? msg?.name ?? '');
                  persist({ id: Number(v), name: msg?.name ?? '', title: msg?.title ?? '' });
                }}
                options={msgOptions}
                isLoading={msgsLoading}
                onSearchChange={debounceMsg}
                placeholder={t('automations.editor.trigger.selectMessage')}
                className="h-9 w-full text-sm"
                popoverClassName="w-[var(--radix-popover-trigger-width)]"
              />
            </div>
          )}
        </>
      )}

      {triggerType === 'custom_events' && (
        <div className="space-y-2">
          <Label>{t('automations.editor.trigger.customEvent')}</Label>
          <SearchableApiSelect
            value={customEventId}
            onValueChange={(v) => {
              const ce = ceRes?.results?.find((e) => String(e.id) === v);
              if (ce) {
                setCustomEventId(String(ce.id));
                setCustomEventName(ce.name);
                persist({ id: ce.id, name: ce.name });
              }
            }}
            options={ceOptions}
            isLoading={ceLoading}
            onSearchChange={debounce_ce}
            placeholder={t('automations.editor.trigger.selectCustomEvent')}
            className="h-9 w-full text-sm"
            popoverClassName="w-[var(--radix-popover-trigger-width)]"
          />
        </div>
      )}

      {/* web-push and mobile-push have no sub-fields */}

      <Separator />

      {/* Section 3: Entry frequency */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('automations.editor.trigger.entryOption')}</Label>
        <div className="space-y-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="applyFrequency"
                value={opt.value}
                checked={applyFrequency === opt.value}
                onChange={() => {
                  setApplyFrequency(opt.value);
                  persist({
                    applyFrequency: opt.value,
                    timePeriod: opt.value === 'multiply-period' ? toMinutes(periodDisplay, typeMultiply || 'days') : 0,
                  });
                }}
                className="accent-primary mt-0.5"
              />
              <div>
                <span className="text-sm">{t(opt.labelKey as never)}</span>
                {opt.value === 'multiply-period' && applyFrequency === 'multiply-period' && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-[70px] text-xs"
                      value={periodDisplay}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setPeriodDisplay(val);
                        persist({ timePeriod: toMinutes(val, typeMultiply || 'days') });
                      }}
                    />
                    <Select
                      value={typeMultiply || 'days'}
                      onValueChange={(v) => {
                        setTypeMultiply(v);
                        persist({
                          typeMultiply: v as TriggerSettings['typeMultiply'],
                          timePeriod: toMinutes(periodDisplay, v),
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-[100px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value} className="text-xs">
                            {t(u.labelKey as never)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Section 4: Entry condition filter */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t('automations.editor.trigger.entryCondition')}</Label>
        <BuilderProvider
          initialCards={conditionInitialCards}
          onStateChange={handleConditionChange}
          stepTypes={AUTOMATION_CONDITION_STEP_TYPES}
        >
          <AutomationConditionBuilder />
        </BuilderProvider>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}
