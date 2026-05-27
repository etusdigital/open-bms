import { useState, useCallback, useMemo, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { SlidersHorizontal, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { subDays, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTagOptions, useSegmentOptions } from '../use-contact-tags';
import type { ContactsSearchParams, ContactStatusFilter } from '../contacts-search-schema';
import { contactStatusOptions, parseCsvIds, serializeCsvIds } from '../contacts-search-schema';

interface ContactsFilterBarProps {
  searchParams: ContactsSearchParams;
}

const TODAY = startOfDay(new Date());
const MIN_DATE = subDays(TODAY, 90);

export function ContactsFilterBar({ searchParams }: ContactsFilterBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Parse current URL state
  const currentTagIds = useMemo(() => parseCsvIds(searchParams.tags), [searchParams.tags]);
  const currentSegmentIds = useMemo(() => parseCsvIds(searchParams.segments), [searchParams.segments]);

  // Local draft state — only applied on "Aplicar" click
  const [draftTags, setDraftTags] = useState<number[]>(currentTagIds);
  const [draftSegments, setDraftSegments] = useState<number[]>(currentSegmentIds);
  const [draftStatus, setDraftStatus] = useState<ContactStatusFilter>(searchParams.status);
  const [draftDateRange, setDraftDateRange] = useState<DateRange | undefined>(() => {
    if (searchParams.startDate && searchParams.endDate) {
      return { from: new Date(searchParams.startDate), to: new Date(searchParams.endDate) };
    }
    return undefined;
  });

  // Search within tags/segments lists
  const [tagSearch, setTagSearch] = useState('');
  const [segmentSearch, setSegmentSearch] = useState('');

  // Collapsible sections
  const [tagsOpen, setTagsOpen] = useState(true);
  const [segmentsOpen, setSegmentsOpen] = useState(true);
  const [dateOpen, setDateOpen] = useState(true);

  // Lazy-load options
  const [tagsEnabled, setTagsEnabled] = useState(false);
  const [segmentsEnabled, setSegmentsEnabled] = useState(false);

  const tagsQuery = useTagOptions(tagsEnabled);
  const segmentsQuery = useSegmentOptions(segmentsEnabled);

  // Sync draft state when popover opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        setDraftTags(currentTagIds);
        setDraftSegments(currentSegmentIds);
        setDraftStatus(searchParams.status);
        setDraftDateRange(
          searchParams.startDate && searchParams.endDate
            ? { from: new Date(searchParams.startDate), to: new Date(searchParams.endDate) }
            : undefined,
        );
        setTagSearch('');
        setSegmentSearch('');
        if (!tagsEnabled) setTagsEnabled(true);
        if (!segmentsEnabled) setSegmentsEnabled(true);
      }
    },
    [currentTagIds, currentSegmentIds, searchParams, tagsEnabled, segmentsEnabled],
  );

  // Toggle helpers
  const toggleTag = (id: number) => {
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };
  const toggleSegment = (id: number) => {
    setDraftSegments((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  // Filter options by search
  const filteredTags = useMemo(() => {
    const opts = tagsQuery.data ?? [];
    if (!tagSearch) return opts;
    const lower = tagSearch.toLowerCase();
    return opts.filter((o) => o.label.toLowerCase().includes(lower));
  }, [tagsQuery.data, tagSearch]);

  const filteredSegments = useMemo(() => {
    const opts = segmentsQuery.data ?? [];
    if (!segmentSearch) return opts;
    const lower = segmentSearch.toLowerCase();
    return opts.filter((o) => o.label.toLowerCase().includes(lower));
  }, [segmentsQuery.data, segmentSearch]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += currentTagIds.length;
    count += currentSegmentIds.length;
    if (searchParams.status !== 'all') count += 1;
    if (searchParams.startDate && searchParams.endDate) count += 1;
    return count;
  }, [currentTagIds, currentSegmentIds, searchParams.status, searchParams.startDate, searchParams.endDate]);

  // Apply filters to URL
  const handleApply = useCallback(() => {
    startTransition(() => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          tags: serializeCsvIds(draftTags),
          segments: serializeCsvIds(draftSegments),
          status: draftStatus,
          startDate: draftDateRange?.from ? format(draftDateRange.from, 'yyyy-MM-dd') : '',
          endDate: draftDateRange?.to ? format(draftDateRange.to, 'yyyy-MM-dd') : '',
          page: 1,
        }),
      } as never);
    });
    setOpen(false);
  }, [navigate, draftTags, draftSegments, draftStatus, draftDateRange]);

  // Clear all filters and immediately apply (send clean query to API)
  const handleClear = useCallback(() => {
    setDraftTags([]);
    setDraftSegments([]);
    setDraftStatus('all');
    setDraftDateRange(undefined);
    startTransition(() => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          tags: '',
          segments: '',
          status: 'all',
          startDate: '',
          endDate: '',
          page: 1,
        }),
      } as never);
    });
    setOpen(false);
  }, [navigate]);

  const statusLabels: Record<ContactStatusFilter, string> = {
    all: t('contacts.filterStatusAll', 'Todos os status'),
    active: t('contacts.statusActive'),
    unsubscribed: t('contacts.statusUnsubscribed'),
    bounced: t('contacts.statusBounced'),
    blocked: t('contacts.statusBlocked'),
  };

  const dateLabel =
    draftDateRange?.from && draftDateRange?.to
      ? `${format(draftDateRange.from, 'dd/MM/yyyy')} - ${format(draftDateRange.to, 'dd/MM/yyyy')}`
      : t('contacts.filterSelectDate', 'Selecionar período');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs font-normal">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('contacts.moreFilters', 'Mais filtros')}
          {activeFilterCount > 0 && (
            <Badge className="flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        align="end"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[70vh] overflow-y-auto">
          {/* Tags Section */}
          <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                Tags
                {draftTags.length > 0 && (
                  <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-[10px]">
                    {draftTags.length}
                  </Badge>
                )}
              </span>
              {tagsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3">
                <div className="relative mb-2">
                  <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
                  <Input
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder={t('common.search', 'Pesquisar')}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <ScrollArea className="h-[140px]">
                  <div className="space-y-1">
                    {filteredTags.map((tag) => {
                      const id = Number(tag.value);
                      const checked = draftTags.includes(id);
                      return (
                        <label
                          key={tag.value}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleTag(id)} />
                          <span className="truncate">{tag.label}</span>
                        </label>
                      );
                    })}
                    {filteredTags.length === 0 && (
                      <p className="text-muted-foreground py-2 text-center text-xs">
                        {t('common.noResults', 'Nenhum resultado')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t" />

          {/* Segments Section */}
          <Collapsible open={segmentsOpen} onOpenChange={setSegmentsOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                {t('contacts.filterSegments', 'Segmentos')}
                {draftSegments.length > 0 && (
                  <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-[10px]">
                    {draftSegments.length}
                  </Badge>
                )}
              </span>
              {segmentsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3">
                <div className="relative mb-2">
                  <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
                  <Input
                    value={segmentSearch}
                    onChange={(e) => setSegmentSearch(e.target.value)}
                    placeholder={t('common.search', 'Pesquisar')}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <ScrollArea className="h-[140px]">
                  <div className="space-y-1">
                    {filteredSegments.map((seg) => {
                      const id = Number(seg.value);
                      const checked = draftSegments.includes(id);
                      return (
                        <label
                          key={seg.value}
                          className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleSegment(id)} />
                          <span className="truncate">{seg.label}</span>
                        </label>
                      );
                    })}
                    {filteredSegments.length === 0 && (
                      <p className="text-muted-foreground py-2 text-center text-xs">
                        {t('common.noResults', 'Nenhum resultado')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t" />

          {/* Status Section */}
          <div className="px-4 py-3">
            <p className="mb-2 text-sm font-semibold">{t('contacts.status', 'Status')}</p>
            <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as ContactStatusFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contactStatusOptions.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t" />

          {/* Date Range Section */}
          <Collapsible open={dateOpen} onOpenChange={setDateOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              {t('contacts.filterDateRange', 'Data de Cadastro')}
              {dateOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3">
                <p className="text-muted-foreground mb-2 text-xs">{dateLabel}</p>
                <Calendar
                  mode="range"
                  selected={draftDateRange}
                  onSelect={setDraftDateRange}
                  locale={ptBR}
                  disabled={{ before: MIN_DATE, after: TODAY }}
                  defaultMonth={draftDateRange?.from ?? TODAY}
                  className="w-full rounded-md border p-2"
                  classNames={{
                    months: 'w-full',
                    month: 'w-full',
                    month_grid: 'w-full',
                    weekdays: 'flex w-full',
                    weekday: 'flex-1 text-center text-muted-foreground text-[0.8rem] font-normal',
                    week: 'flex w-full mt-1',
                    day: cn(
                      'relative flex-1 p-0 text-center text-sm focus-within:relative focus-within:z-20',
                      '[&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50',
                      '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
                    ),
                    day_button:
                      'h-8 w-full font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md',
                  }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer: Clear + Apply */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" onClick={handleClear} className="text-xs">
            {t('contacts.filterClear', 'Limpar')}
          </Button>
          <Button size="sm" onClick={handleApply} className="text-xs">
            {t('contacts.filterApply', 'Aplicar')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
