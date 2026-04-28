import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { useSearchMessages, type SearchableMessage } from '@/features/campaigns/use-campaign-messages';
import { useValidateCampaignName } from '@/features/campaigns/use-campaigns';
import { useDebounce } from '@/hooks/use-debounce';
import type { CampaignMessageType } from '@/features/campaigns/types';
import {
  triggerCampaignFormSchema,
  TRIGGER_TITLE_MAX,
  TRIGGER_DESCRIPTION_MAX,
  type TriggerCampaignFormValues,
} from './trigger-campaign-schema';
import { useCustomEvents } from './use-trigger-campaigns';
import { BuilderProvider } from '@/features/segments/builder/builder-context';
import { ConditionBuilder } from '@/features/segments/builder/condition-builder';
import { parseSteps } from '@/features/segments/builder/builder-serializer';
import type { BuilderState } from '@/features/segments/builder/types';
import { serializeConditionalForTrigger } from './build-trigger-payload';

interface TriggerCampaignFormProps {
  defaultValues?: Partial<TriggerCampaignFormValues>;
  campaignId?: number;
  initialConditional?: unknown[];
  onSubmit: (data: TriggerCampaignFormValues, conditional: unknown[]) => void;
  isPending: boolean;
}

type SectionId = 'what' | 'who' | 'when';

export default function TriggerCampaignForm({
  defaultValues,
  campaignId,
  initialConditional,
  onSubmit,
  isPending,
}: TriggerCampaignFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;
  const [openSection, setOpenSection] = useState<SectionId>('what');
  const initialCards = parseSteps(initialConditional ?? []);
  const builderStateRef = useRef<BuilderState>({ cards: initialCards });

  const form = useForm<TriggerCampaignFormValues>({
    resolver: zodResolver(triggerCampaignFormSchema) as never,
    defaultValues: {
      title: '',
      description: '',
      messageType: 'email',
      messages: [],
      triggerType: 'events',
      eventType: 'open',
      frequency: 'unique',
      timePeriodValue: 1,
      timePeriodUnit: 'days' as const,
      sendTiming: 'immediate',
      waitValue: 0,
      waitUnit: 'hours' as const,
      ...defaultValues,
    },
  });

  const title = form.watch('title') ?? '';
  const titleLength = title.length;
  const debouncedTitle = useDebounce(title, 300);
  const { data: titleValidation } = useValidateCampaignName(debouncedTitle, 'title', campaignId);
  const isTitleTaken = Array.isArray(titleValidation) && titleValidation.length > 0;
  const triggerType = form.watch('triggerType');
  const eventType = form.watch('eventType');
  const sendTiming = form.watch('sendTiming');
  const frequency = form.watch('frequency');
  const showMessageTarget = triggerType === 'events' && eventType !== 'first_open_30_days';

  const toggleSection = (id: SectionId) => {
    setOpenSection((prev) => (prev === id ? prev : id));
  };

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => {
            const conditional = serializeConditionalForTrigger(builderStateRef.current.cards);
            onSubmit(data, conditional);
          })}
          className="space-y-4"
        >
          {/* Settings — Nome e Descrição fora dos accordions (como Vue2) */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('triggerCampaigns.title')}</FormLabel>
                      <span className="text-muted-foreground text-xs">
                        {t('validation.charCount', { count: titleLength, max: TRIGGER_TITLE_MAX })}
                      </span>
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={TRIGGER_TITLE_MAX}
                        placeholder={t('triggerCampaigns.titlePlaceholder', 'Digite o nome da campanha')}
                      />
                    </FormControl>
                    <FormMessage />
                    {isTitleTaken && (
                      <p className="text-xs text-red-500" data-testid="title-not-available">
                        {t('campaigns.nameAlreadyExists')}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaigns.description')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={TRIGGER_DESCRIPTION_MAX}
                        placeholder={t('triggerCampaigns.descriptionPlaceholder', 'Digite a descrição da campanha')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section 1 - What */}
          <AccordionSection
            number={1}
            title={t('triggerCampaigns.sectionWhat')}
            subtitle={t('triggerCampaigns.sectionWhatSubtitle', 'Selecione ou crie uma mensagem')}
            isOpen={openSection === 'what'}
            onToggle={() => toggleSection('what')}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="messageType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('triggerCampaigns.messageTypeLabel', 'Tipo de Mensagem')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="web-push">Web Push</SelectItem>
                        <SelectItem value="mobile-push">Mobile Push</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <TriggerMessageSelect
                messageType={form.watch('messageType') as CampaignMessageType}
                selectedMessages={form.watch('messages') ?? []}
                onMessagesChange={(msgs) =>
                  form.setValue('messages', msgs as never, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                t={t as never}
              />
              {form.formState.errors.messages && (
                <p className="text-xs text-red-500">{form.formState.errors.messages.message}</p>
              )}

              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => toggleSection('who')}>
                  {t('common.next', 'Próximo')}
                </Button>
              </div>
            </div>
          </AccordionSection>

          {/* Section 2 - Who */}
          <AccordionSection
            number={2}
            title={t('triggerCampaigns.sectionWho')}
            subtitle={t('triggerCampaigns.sectionWhoSubtitle', 'Defina para quem enviará a campanha')}
            isOpen={openSection === 'who'}
            onToggle={() => toggleSection('who')}
          >
            <div className="space-y-4">
              {/* Unified trigger type Select — like Vue2 "Selecionar o tipo de evento" */}
              <FormField
                control={form.control}
                name="triggerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('triggerCampaigns.selectEventType', 'Selecionar o tipo de evento')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v === 'custom_events') {
                          form.setValue('eventType', '' as never);
                        } else {
                          form.setValue('eventType', 'open');
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('triggerCampaigns.selectTypePlaceholder', 'Selecionar o tipo')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="events">{t('triggerCampaigns.triggerTypeEvents')}</SelectItem>
                        <SelectItem value="custom_events">{t('triggerCampaigns.triggerTypeCustom')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sub-fields for events: event type + message target */}
              {triggerType === 'events' && (
                <>
                  <FormField
                    control={form.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('triggerCampaigns.eventTypeLabel')}</FormLabel>
                        <Select value={field.value ?? 'open'} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open">{t('triggerCampaigns.eventOpen')}</SelectItem>
                            <SelectItem value="click">{t('triggerCampaigns.eventClick')}</SelectItem>
                            <SelectItem value="first_open_30_days">{t('triggerCampaigns.eventFirstOpen')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {showMessageTarget && (
                    <MessageTargetSelector
                      messageType={form.watch('messageType') as CampaignMessageType}
                      selectedId={form.watch('triggerMessageId')}
                      selectedTitle={form.watch('triggerMessageTitle')}
                      onSelect={(id, title) => {
                        form.setValue('triggerMessageId', id, { shouldDirty: true });
                        form.setValue('triggerMessageTitle', title, { shouldDirty: true });
                      }}
                      onClear={() => {
                        form.setValue('triggerMessageId', undefined, { shouldDirty: true });
                        form.setValue('triggerMessageTitle', undefined, { shouldDirty: true });
                      }}
                      t={t as never}
                    />
                  )}
                </>
              )}

              {/* Sub-field for custom events: selector right after type select */}
              {triggerType === 'custom_events' && (
                <CustomEventSelector
                  selectedEvent={form.watch('customEvent')}
                  onEventChange={(evt) => form.setValue('customEvent', evt, { shouldDirty: true })}
                  t={t as never}
                />
              )}

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('triggerCampaigns.contactEntryLabel', 'Opção de entrada dos contatos:')}</FormLabel>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="unique"
                          checked={field.value === 'unique'}
                          onChange={() => field.onChange('unique')}
                          className="accent-primary"
                        />
                        {t('triggerCampaigns.frequencyUnique')}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="multiply-period"
                          checked={field.value === 'multiply-period'}
                          onChange={() => field.onChange('multiply-period')}
                          className="accent-primary"
                        />
                        {t('triggerCampaigns.frequencyMultiple')}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="multiply"
                          checked={field.value === 'multiply'}
                          onChange={() => field.onChange('multiply')}
                          className="accent-primary"
                        />
                        {t('triggerCampaigns.frequencyUnlimited')}
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {frequency === 'multiply-period' && (
                <div className="flex gap-3">
                  <FormField
                    control={form.control}
                    name="timePeriodValue"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t('triggerCampaigns.timePeriodLabel', 'Período')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            data-testid="time-period-value"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            value={field.value ?? 1}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timePeriodUnit"
                    render={({ field }) => (
                      <FormItem className="w-36">
                        <FormLabel>&nbsp;</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="time-period-unit">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="days">{t('triggerCampaigns.unitDays', 'Dias')}</SelectItem>
                            <SelectItem value="hours">{t('triggerCampaigns.unitHours', 'Horas')}</SelectItem>
                            <SelectItem value="minutes">{t('triggerCampaigns.unitMinutes', 'Minutos')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div data-testid="conditional-builder">
                <p className="mb-2 text-sm font-medium">{t('triggerCampaigns.conditionalLabel', 'Condicional')}</p>
                <BuilderProvider
                  initialCards={initialCards}
                  isDisabled={isPending}
                  context="trigger"
                  onStateChange={(state) => {
                    builderStateRef.current = state;
                  }}
                >
                  <ConditionBuilder />
                </BuilderProvider>
              </div>

              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={() => toggleSection('when')}>
                  {t('common.next', 'Próximo')}
                </Button>
              </div>
            </div>
          </AccordionSection>

          {/* Section 3 - When */}
          <AccordionSection
            number={3}
            title={t('triggerCampaigns.sectionWhen')}
            subtitle={t('triggerCampaigns.sectionWhenSubtitle', 'Defina a data e horário para envio da campanha')}
            isOpen={openSection === 'when'}
            onToggle={() => toggleSection('when')}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="sendTiming"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('triggerCampaigns.sendTimingLabel')}</FormLabel>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="immediate"
                          checked={field.value === 'immediate'}
                          onChange={() => field.onChange('immediate')}
                          className="accent-primary"
                        />
                        {t('triggerCampaigns.sendImmediate')}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="wait"
                          checked={field.value === 'wait'}
                          onChange={() => field.onChange('wait')}
                          className="accent-primary"
                        />
                        {t('triggerCampaigns.sendWait')}
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {sendTiming === 'wait' && (
                <div className="flex gap-3">
                  <FormField
                    control={form.control}
                    name="waitValue"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t('triggerCampaigns.waitMinutes')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            value={field.value ?? 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="waitUnit"
                    render={({ field }) => (
                      <FormItem className="w-36">
                        <FormLabel>&nbsp;</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hours">{t('triggerCampaigns.unitHours', 'Horas')}</SelectItem>
                            <SelectItem value="minutes">{t('triggerCampaigns.unitMinutes', 'Minutos')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </AccordionSection>

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}

function AccordionSection({
  number,
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
          {number}
        </span>
        <div className="flex-1">
          <span className="font-medium">{title}</span>
          {subtitle && !isOpen && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
        {isOpen ? (
          <ChevronUp className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        )}
      </button>
      <div className={isOpen ? 'border-t px-4 py-4' : 'hidden'}>{children}</div>
    </div>
  );
}

function TriggerMessageSelect({
  messageType,
  selectedMessages,
  onMessagesChange,
  t,
}: {
  messageType: CampaignMessageType;
  selectedMessages: Array<{
    id: number;
    title: string;
    subject?: string;
    name?: string;
    links?: string[];
  }>;
  onMessagesChange: (msgs: typeof selectedMessages) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: results = [] } = useSearchMessages({ title: query, messageType });
  const selectedIds = new Set(selectedMessages.map((m) => m.id));
  const canAddMore = selectedMessages.length < 10;

  const addMessage = (msg: SearchableMessage) => {
    if (selectedIds.has(msg.id) || !canAddMore) return;
    onMessagesChange([
      ...selectedMessages,
      {
        id: msg.id,
        title: msg.title,
        subject: msg.subject ?? '',
        name: (msg as any).name ?? '',
        links: [],
      },
    ]);
  };

  const removeMessage = (index: number) => {
    onMessagesChange(selectedMessages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Selected messages list */}
      {selectedMessages.map((msg, i) => (
        <div key={msg.id} className="space-y-1 rounded-lg border p-3" data-testid={`trigger-message-selected-${i}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{msg.title}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid={`remove-message-${i}`}
              onClick={() => removeMessage(i)}
            >
              {t('campaigns.removeMessage')}
            </Button>
          </div>
          {msg.subject && <p className="text-muted-foreground text-xs">{msg.subject}</p>}
        </div>
      ))}

      {/* Search button */}
      {canAddMore && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 font-normal"
              data-testid="trigger-message-search"
            >
              <Search className="h-4 w-4" />
              {t('campaigns.messageSearch')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder={t('campaigns.messageSearch')} value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>{t('common.noResults', 'Nenhum resultado.')}</CommandEmpty>
                <CommandGroup>
                  {results.map((msg) => (
                    <CommandItem
                      key={msg.id}
                      value={String(msg.id)}
                      disabled={selectedIds.has(msg.id)}
                      onSelect={() => {
                        addMessage(msg);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{msg.title}</span>
                        {msg.subject && <span className="text-muted-foreground text-xs">{msg.subject}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function MessageTargetSelector({
  messageType,
  selectedId,
  selectedTitle,
  onSelect,
  onClear,
  t,
}: {
  messageType: CampaignMessageType;
  selectedId?: number;
  selectedTitle?: string;
  onSelect: (id: number, title: string) => void;
  onClear: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: results = [] } = useSearchMessages({ title: query, messageType });

  if (selectedId && selectedTitle) {
    return (
      <div className="rounded-lg border p-3" data-testid="trigger-message-target">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs">
              {t('triggerCampaigns.messageTarget', 'Mensagem do gatilho')}
            </p>
            <p className="text-sm font-medium">{selectedTitle}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t('common.remove', 'Remover')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="trigger-message-target">
      <p className="text-muted-foreground mb-1 text-xs">{t('triggerCampaigns.messageTarget', 'Mensagem do gatilho')}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start gap-2 font-normal">
            <Search className="h-4 w-4" />
            {t('triggerCampaigns.selectTriggerMessage', 'Selecionar mensagem...')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t('campaigns.messageSearch')} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{t('common.noResults', 'Nenhum resultado.')}</CommandEmpty>
              <CommandGroup>
                {results.map((msg) => (
                  <CommandItem
                    key={msg.id}
                    value={String(msg.id)}
                    onSelect={() => {
                      onSelect(msg.id, msg.title);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{msg.title}</span>
                      {msg.subject && <span className="text-muted-foreground text-xs">{msg.subject}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CustomEventSelector({
  selectedEvent,
  onEventChange,
  t,
}: {
  selectedEvent?: { id: number; name: string };
  onEventChange: (evt: { id: number; name: string } | undefined) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: events = [] } = useCustomEvents(query) as {
    data: Array<{ id: number; name: string }>;
  };

  if (selectedEvent) {
    return (
      <div className="rounded-lg border p-3" data-testid="custom-event-selector">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{selectedEvent.name}</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEventChange(undefined)}>
            {t('common.remove', 'Remover')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 font-normal"
          data-testid="custom-event-selector"
        >
          <Search className="h-4 w-4" />
          {t('triggerCampaigns.searchCustomEvent', 'Buscar evento personalizado...')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('triggerCampaigns.searchCustomEvent', 'Buscar evento personalizado...')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{t('common.noResults', 'Nenhum resultado.')}</CommandEmpty>
            <CommandGroup>
              {events.map((evt) => (
                <CommandItem
                  key={evt.id}
                  value={String(evt.id)}
                  onSelect={() => {
                    onEventChange({ id: evt.id, name: evt.name });
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="text-sm">{evt.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
