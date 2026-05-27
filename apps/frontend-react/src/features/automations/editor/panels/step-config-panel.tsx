import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableApiSelect, type SelectOption } from '@/features/segments/builder/searchable-api-select';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type {
  AnyNodeData,
  TriggerNodeData,
  WaitNodeData,
  MessageNodeData,
  TestABNodeData,
  TestABMessage,
  RandomMessageNodeData,
  TagNodeData,
  UpdateCustomFieldNodeData,
  ContactTransferNodeData,
  RemoveAutomationNodeData,
  SplitNodeData,
  ConditionalTimeNodeData,
  ConditionalNodeData,
  HttpRequestNodeData,
} from '../types';
import { MESSAGE_TYPE_MAP } from '../types';
import {
  TagConfig,
  UpdateCustomFieldConfig,
  ContactTransferConfig,
  RemoveAutomationConfig,
} from './contact-config-panels';
import { ConditionalConfigPanel } from './conditional-config-panel';
import { HttpRequestConfig } from './http-request-config';
import { TriggerConfigPanel } from './trigger-config-panel';
import { useEditorActions } from '../editor-context';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface StepConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeType: string;
  nodeData: AnyNodeData;
  onSave: (settings: Record<string, unknown>) => void;
}

export function StepConfigPanel({ open, onOpenChange, nodeId, nodeType, nodeData, onSave }: StepConfigPanelProps) {
  const { t } = useTranslation();
  const isWide = nodeType === 'conditional' || nodeType === 'httpRequest' || nodeType === 'trigger';

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent className={isWide ? 'sm:max-w-2xl' : 'sm:max-w-md'} showOverlay={false}>
        <SheetHeader>
          <SheetTitle>{t(`automations.editor.configure_${nodeType}` as never)}</SheetTitle>
          <SheetDescription>{t('automations.editor.configureDescription')}</SheetDescription>
        </SheetHeader>
        <div className="mt-2 flex-1 overflow-y-auto px-4">
          {nodeType === 'trigger' && (
            <TriggerConfigPanel
              data={nodeData as TriggerNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
          {nodeType === 'wait' && (
            <WaitConfig data={nodeData as WaitNodeData} onSave={onSave} onClose={() => onOpenChange(false)} />
          )}
          {nodeType === 'testAB' && (
            <TestABConfig data={nodeData as TestABNodeData} onSave={onSave} onClose={() => onOpenChange(false)} />
          )}
          {(['randomMessage', 'randomWebPush', 'randomMobilePush'] as string[]).includes(nodeType) && (
            <RandomMessageConfig
              data={nodeData as RandomMessageNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
              messageType={MESSAGE_TYPE_MAP[nodeType] ?? 'email'}
            />
          )}
          {(['email', 'webPush', 'mobilePush', 'sms', 'whatsapp'] as string[]).includes(nodeType) && (
            <MessageConfig
              data={nodeData as MessageNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
              messageType={MESSAGE_TYPE_MAP[nodeType] ?? 'email'}
            />
          )}
          {(nodeType === 'addTag' || nodeType === 'removeTag') && (
            <TagConfig data={nodeData as TagNodeData} onSave={onSave} onClose={() => onOpenChange(false)} />
          )}
          {nodeType === 'updateCustomField' && (
            <UpdateCustomFieldConfig
              data={nodeData as UpdateCustomFieldNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
          {nodeType === 'contactTransfer' && (
            <ContactTransferConfig
              data={nodeData as ContactTransferNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
          {nodeType === 'httpRequest' && (
            <HttpRequestConfig
              data={nodeData as HttpRequestNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
          {nodeType === 'conditional' && (
            <ConditionalConfigPanel
              data={nodeData as ConditionalNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
          {nodeType === 'split' && (
            <SplitConfig
              data={nodeData as SplitNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
              nodeId={nodeId}
            />
          )}
          {nodeType === 'conditionalTime' && (
            <ConditionalTimeConfig
              data={nodeData as ConditionalTimeNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
          {nodeType === 'removeAutomation' && (
            <RemoveAutomationConfig
              data={nodeData as RemoveAutomationNodeData}
              onSave={onSave}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Wait config
// ---------------------------------------------------------------------------

function WaitConfig({
  data,
  onSave,
  onClose,
}: {
  data: WaitNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [timer, setTimer] = useState(String(data.settings.timer ?? 1));
  const [timerType, setTimerType] = useState(data.settings.timerType ?? 'hours');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ timer: Number(timer) || 1, timerType });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('automations.editor.duration')}</Label>
        <Input type="number" min={1} value={timer} onChange={(e) => setTimer(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>{t('automations.editor.unit')}</Label>
        <Select value={timerType} onValueChange={(v) => setTimerType(v as 'hours' | 'minutes')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hours">{t('automations.editor.hours')}</SelectItem>
            <SelectItem value="minutes">{t('automations.editor.minutes')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit">{t('common.save')}</Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Email config — searchable message select with debounced API search
// ---------------------------------------------------------------------------

interface MessageOption {
  id: number;
  title: string;
  name: string;
  subject?: string;
}

const EMPTY_MESSAGE_OPTIONS: MessageOption[] = [];

function useChannelMessages(messageType: string, search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery<{ results: MessageOption[]; totalItems: number }>({
    queryKey: ['messages', messageType, 'select', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/messages', {
        params: {
          page: 1,
          itemsPerPage: 40,
          type: messageType,
          ...(search && { title: search }),
        },
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

function MessageConfig({
  data,
  onSave,
  onClose,
  messageType,
}: {
  data: MessageNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
  messageType: string;
}) {
  const { t } = useTranslation();
  const [selectedMessageId, setSelectedMessageId] = useState(data.settings.id ? String(data.settings.id) : '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: messagesResponse, isLoading } = useChannelMessages(messageType, debouncedSearch);

  const messages: MessageOption[] = messagesResponse?.results ?? EMPTY_MESSAGE_OPTIONS;

  const options = useMemo(() => {
    const opts: SelectOption[] = messages.map((msg) => ({
      value: String(msg.id),
      label: msg.title,
      description: msg.subject,
    }));

    // If current selection is not in the loaded options, add it so it shows
    if (selectedMessageId && data.settings.title && !opts.find((o) => o.value === selectedMessageId)) {
      opts.unshift({
        value: selectedMessageId,
        label: data.settings.title,
        description: data.settings.subject,
      });
    }
    return opts;
  }, [messages, selectedMessageId, data.settings.title, data.settings.subject]);

  const handleSearchChange = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelect = (messageId: string) => {
    setSelectedMessageId(messageId);
    const msg = messages.find((m) => String(m.id) === messageId);
    if (msg) {
      onSave({
        id: msg.id,
        name: msg.name,
        title: msg.title,
        subject: msg.subject ?? '',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('automations.editor.selectEmailMessage')}</Label>
        <SearchableApiSelect
          value={selectedMessageId}
          onValueChange={handleSelect}
          options={options}
          isLoading={isLoading}
          onSearchChange={handleSearchChange}
          placeholder={t('automations.editor.searchMessages')}
          emptyMessage={t('automations.editor.noMessagesFound')}
          className="h-9 w-full text-sm"
          popoverClassName="w-[var(--radix-popover-trigger-width)]"
        />
      </div>

      {selectedMessageId &&
        (() => {
          const selected = messages.find((m) => String(m.id) === selectedMessageId);
          const title = selected?.title ?? data.settings.title;
          const subject = selected?.subject ?? data.settings.subject;
          if (!title) return null;
          return (
            <div className="bg-muted/50 rounded-md border p-3 text-sm">
              <p className="font-medium">{title}</p>
              {subject && <p className="text-muted-foreground mt-1 text-xs">{subject}</p>}
            </div>
          );
        })()}

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test A/B config
// ---------------------------------------------------------------------------

const MESSAGE_LABELS = ['A', 'B', 'C', 'D'];
const MAX_MESSAGES = 4;

function TestABConfig({
  data,
  onSave,
  onClose,
}: {
  data: TestABNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<TestABMessage[]>(data.settings.messages ?? []);
  const [winnerCriteria, setWinnerCriteria] = useState<'click' | 'open'>(data.settings.winnerCriteria ?? 'open');
  const [duration, setDuration] = useState(
    String(data.settings.durationType === 'day' ? (data.settings.duration ?? 24) / 24 : (data.settings.duration ?? 24)),
  );
  const [durationType, setDurationType] = useState<'day' | 'hour'>(data.settings.durationType ?? 'day');

  // Message search (testAB is always email)
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: messagesResponse, isLoading } = useChannelMessages('email', debouncedSearch);
  const availableMessages: MessageOption[] = messagesResponse?.results ?? EMPTY_MESSAGE_OPTIONS;

  const options: SelectOption[] = availableMessages
    .filter((m) => !messages.some((sel) => sel.id === m.id))
    .map((msg) => ({
      value: String(msg.id),
      label: msg.title,
      description: msg.subject,
    }));

  const handleSearchChange = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const addMessage = (messageId: string) => {
    if (messages.length >= MAX_MESSAGES) return;
    const msg = availableMessages.find((m) => String(m.id) === messageId);
    if (!msg || messages.some((m) => m.id === msg.id)) return;

    const updated = [...messages, { id: msg.id, name: msg.name, title: msg.title, subject: msg.subject }];
    setMessages(updated);
    saveSettings(updated, winnerCriteria, duration, durationType);
  };

  const removeMessage = (id: number) => {
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    saveSettings(updated, winnerCriteria, duration, durationType);
  };

  const saveSettings = (msgs: TestABMessage[], criteria: 'click' | 'open', dur: string, durType: 'day' | 'hour') => {
    const durationHours = durType === 'day' ? (Number(dur) || 1) * 24 : Number(dur) || 24;
    onSave({
      ...data.settings,
      messages: msgs,
      winnerCriteria: criteria,
      status: data.settings.status ?? 'notStarted',
      duration: durationHours,
      durationType: durType,
    });
  };

  return (
    <div className="space-y-5">
      {/* Message select */}
      <div className="space-y-2">
        <Label>{t('automations.editor.testAB.selectMessages')}</Label>
        {messages.length < MAX_MESSAGES && (
          <SearchableApiSelect
            value=""
            onValueChange={addMessage}
            options={options}
            isLoading={isLoading}
            onSearchChange={handleSearchChange}
            placeholder={t('automations.editor.searchMessages')}
            emptyMessage={t('automations.editor.noMessagesFound')}
            className="h-9 w-full text-sm"
            popoverClassName="w-[var(--radix-popover-trigger-width)]"
          />
        )}
        <p className="text-muted-foreground text-xs">
          {t('automations.editor.testAB.selected', { count: messages.length, max: MAX_MESSAGES })}
        </p>
      </div>

      {/* Selected messages list */}
      {messages.length > 0 && (
        <div className="space-y-1.5">
          {messages.map((msg, i) => (
            <div key={msg.id} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-muted-foreground w-5 text-xs font-bold">{MESSAGE_LABELS[i]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{msg.title || msg.name}</p>
                {msg.subject && <p className="text-muted-foreground truncate text-xs">{msg.subject}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-7 w-7 shrink-0"
                onClick={() => removeMessage(msg.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Winner criteria */}
      <div className="space-y-2">
        <Label>{t('automations.editor.testAB.winnerCriteria')}</Label>
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="winnerCriteria"
              value="click"
              checked={winnerCriteria === 'click'}
              onChange={() => {
                setWinnerCriteria('click');
                saveSettings(messages, 'click', duration, durationType);
              }}
              className="accent-primary"
            />
            <span className="text-sm">{t('automations.editor.testAB.clickRate')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="winnerCriteria"
              value="open"
              checked={winnerCriteria === 'open'}
              onChange={() => {
                setWinnerCriteria('open');
                saveSettings(messages, 'open', duration, durationType);
              }}
              className="accent-primary"
            />
            <span className="text-sm">{t('automations.editor.testAB.openRate')}</span>
          </label>
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label>{t('automations.editor.testAB.duration')}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={1}
            max={durationType === 'day' ? 30 : 720}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              saveSettings(messages, winnerCriteria, e.target.value, durationType);
            }}
          />
          <Select
            value={durationType}
            onValueChange={(v) => {
              const newType = v as 'day' | 'hour';
              setDurationType(newType);
              saveSettings(messages, winnerCriteria, duration, newType);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('automations.editor.testAB.days')}</SelectItem>
              <SelectItem value="hour">{t('automations.editor.testAB.hours')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Random message config — multiple emails sent randomly
// ---------------------------------------------------------------------------

const MAX_RANDOM_MESSAGES = 10;
const RANDOM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function RandomMessageConfig({
  data,
  onSave,
  onClose,
  messageType,
}: {
  data: RandomMessageNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
  messageType: string;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Array<{ id: number; name: string; title: string; subject?: string }>>(
    data.settings.messages ?? [],
  );

  // Message search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: messagesResponse, isLoading } = useChannelMessages(messageType, debouncedSearch);
  const availableMessages: MessageOption[] = messagesResponse?.results ?? EMPTY_MESSAGE_OPTIONS;

  const options: SelectOption[] = availableMessages
    .filter((m) => !messages.some((sel) => sel.id === m.id))
    .map((msg) => ({
      value: String(msg.id),
      label: msg.title,
      description: msg.subject,
    }));

  const handleSearchChange = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const persist = (updated: typeof messages) => {
    setMessages(updated);
    onSave({ messages: updated });
  };

  const addMessage = (messageId: string) => {
    if (messages.length >= MAX_RANDOM_MESSAGES) return;
    const msg = availableMessages.find((m) => String(m.id) === messageId);
    if (!msg || messages.some((m) => m.id === msg.id)) return;
    persist([...messages, { id: msg.id, name: msg.name, title: msg.title, subject: msg.subject }]);
  };

  const removeMessage = (id: number) => {
    persist(messages.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Message select */}
      <div className="space-y-2">
        <Label>{t('automations.editor.randomMessage.selectMessages')}</Label>
        {messages.length < MAX_RANDOM_MESSAGES && (
          <SearchableApiSelect
            value=""
            onValueChange={addMessage}
            options={options}
            isLoading={isLoading}
            onSearchChange={handleSearchChange}
            placeholder={t('automations.editor.searchMessages')}
            emptyMessage={t('automations.editor.noMessagesFound')}
            className="h-9 w-full text-sm"
            popoverClassName="w-[var(--radix-popover-trigger-width)]"
          />
        )}
        <p className="text-muted-foreground text-xs">
          {t('automations.editor.randomMessage.selected', {
            count: messages.length,
            max: MAX_RANDOM_MESSAGES,
          })}
        </p>
      </div>

      {/* Selected messages list */}
      {messages.length > 0 && (
        <div className="space-y-1.5">
          {messages.map((msg, i) => (
            <div key={msg.id} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-muted-foreground w-5 text-xs font-bold">{RANDOM_LABELS[i]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{msg.title || msg.name}</p>
                {msg.subject && <p className="text-muted-foreground truncate text-xs">{msg.subject}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-7 w-7 shrink-0"
                onClick={() => removeMessage(msg.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Split config — percentage inputs for 2-5 paths
// ---------------------------------------------------------------------------

const SPLIT_PATH_LABELS = ['A', 'B', 'C', 'D', 'E'];

function SplitConfig({
  data,
  onSave,
  onClose,
  nodeId,
}: {
  data: SplitNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
  nodeId: string;
}) {
  const { t } = useTranslation();
  const { syncSplitPaths } = useEditorActions();
  const initialPaths = Object.keys(data.settings)
    .filter((k) => /^[1-5]$/.test(k))
    .sort()
    .map((k) => ({ key: k, value: data.settings[k] as number }));

  const [paths, setPaths] = useState(
    initialPaths.length >= 2
      ? initialPaths
      : [
          { key: '1', value: 50 },
          { key: '2', value: 50 },
        ],
  );

  const total = paths.reduce((sum, p) => sum + p.value, 0);

  const persist = (updated: typeof paths) => {
    setPaths(updated);
    const settings: Record<string, number> = {};
    updated.forEach((p) => {
      settings[p.key] = p.value;
    });
    // Update split node settings first (adds new handles on next render)
    onSave(settings);
    // Defer sub-node sync to next frame so the new handles exist in the DOM
    requestAnimationFrame(() => {
      syncSplitPaths(nodeId, updated);
    });
  };

  const updateValue = (index: number, value: number) => {
    const updated = [...paths];
    updated[index] = { ...updated[index], value: Math.max(1, Math.min(99, value)) };
    persist(updated);
  };

  const addPath = () => {
    if (paths.length >= 5) return;
    persist([...paths, { key: String(paths.length + 1), value: 0 }]);
  };

  const removePath = () => {
    if (paths.length <= 2) return;
    persist(paths.slice(0, -1));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {paths.map((path, i) => (
          <div key={path.key} className="flex items-center gap-3">
            <span className="text-muted-foreground w-5 text-sm font-bold">{SPLIT_PATH_LABELS[i]}</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={path.value}
              onChange={(e) => updateValue(i, Number(e.target.value) || 0)}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        ))}
      </div>

      <div className={`text-sm font-medium ${total === 100 ? 'text-green-600' : 'text-destructive'}`}>
        {t('automations.editor.conditions.total')}: {total}%
        {total !== 100 && ` (${t('automations.editor.conditions.mustBe100')})`}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addPath} disabled={paths.length >= 5}>
          + {t('automations.editor.conditions.addPath')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={removePath} disabled={paths.length <= 2}>
          - {t('automations.editor.conditions.removePath')}
        </Button>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conditional Time config — start/end hour selects
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function ConditionalTimeConfig({
  data,
  onSave,
  onClose,
}: {
  data: ConditionalTimeNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [initialTime, setInitialTime] = useState(String(data.settings.initialTime ?? 9));
  const [endTime, setEndTime] = useState(String(data.settings.endTime ?? 18));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ initialTime: Number(initialTime), endTime: Number(endTime) });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('automations.editor.conditions.startTime')}</Label>
          <Select value={initialTime} onValueChange={setInitialTime}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {String(h).padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('automations.editor.conditions.endTime')}</Label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {String(h).padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">{t('common.save')}</Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
