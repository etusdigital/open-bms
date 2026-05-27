import { useState, useCallback, useMemo, startTransition, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { SlidersHorizontal, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTagOptions, useSegmentOptions } from '@/features/contacts/use-contact-tags';
import { CampaignStatus, CAMPAIGN_STATUS_LABELS, TYPE_OPTIONS, CHANNEL_OPTIONS } from '../types';
import type { CampaignsSearchParams } from '../campaigns-search-schema';
import { parseCsvIds, serializeCsvIds, parseCsvStrings, serializeCsvStrings } from '../campaigns-search-schema';

const STORAGE_KEY = 'campaignsFilterSettings';

interface SavedFilters {
  status: number[];
  types: string[];
  messages: string[];
  tags: number[];
  segments: number[];
}

export function loadSavedFilters(): { filters: SavedFilters; enabled: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.enabled) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface CampaignsFilterBarProps {
  searchParams: CampaignsSearchParams;
}

const STATUS_ENTRIES = Object.entries(CAMPAIGN_STATUS_LABELS) as [string, string][];

export function CampaignsFilterBar({ searchParams }: CampaignsFilterBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Parse current URL state
  const currentStatus = useMemo(() => parseCsvIds(searchParams.status), [searchParams.status]);
  const currentTypes = useMemo(() => parseCsvStrings(searchParams.types), [searchParams.types]);
  const currentMessages = useMemo(() => parseCsvStrings(searchParams.messages), [searchParams.messages]);
  const currentTagIds = useMemo(() => parseCsvIds(searchParams.tags), [searchParams.tags]);
  const currentSegmentIds = useMemo(() => parseCsvIds(searchParams.segments), [searchParams.segments]);

  // Local draft state — only applied on "Aplicar" click
  const [draftStatus, setDraftStatus] = useState<number[]>(currentStatus);
  const [draftTypes, setDraftTypes] = useState<string[]>(currentTypes);
  const [draftMessages, setDraftMessages] = useState<string[]>(currentMessages);
  const [draftTags, setDraftTags] = useState<number[]>(currentTagIds);
  const [draftSegments, setDraftSegments] = useState<number[]>(currentSegmentIds);

  // Search within tags/segments lists — debounced for API calls
  const [tagSearch, setTagSearch] = useState('');
  const [segmentSearch, setSegmentSearch] = useState('');
  const debouncedTagSearch = useDeferredValue(tagSearch);
  const debouncedSegmentSearch = useDeferredValue(segmentSearch);

  // Collapsible sections
  const [statusOpen, setStatusOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [segmentsOpen, setSegmentsOpen] = useState(false);

  // Lazy-load options with server-side search
  const [tagsEnabled, setTagsEnabled] = useState(false);
  const [segmentsEnabled, setSegmentsEnabled] = useState(false);

  const tagsQuery = useTagOptions(tagsEnabled, debouncedTagSearch);
  const segmentsQuery = useSegmentOptions(segmentsEnabled, debouncedSegmentSearch);

  // Save filter toggle
  const [saveEnabled, setSaveEnabled] = useState(() => loadSavedFilters()?.enabled ?? false);

  // Sync draft state when popover opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        setDraftStatus(currentStatus);
        setDraftTypes(currentTypes);
        setDraftMessages(currentMessages);
        setDraftTags(currentTagIds);
        setDraftSegments(currentSegmentIds);
        setTagSearch('');
        setSegmentSearch('');
        if (!tagsEnabled) setTagsEnabled(true);
        if (!segmentsEnabled) setSegmentsEnabled(true);
      }
    },
    [currentStatus, currentTypes, currentMessages, currentTagIds, currentSegmentIds, tagsEnabled, segmentsEnabled],
  );

  // Toggle helpers
  const toggleStatus = (code: number) => {
    setDraftStatus((prev) => (prev.includes(code) ? prev.filter((v) => v !== code) : [...prev, code]));
  };
  const toggleType = (value: string) => {
    setDraftTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };
  const toggleMessage = (value: string) => {
    setDraftMessages((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };
  const toggleTag = (id: number) => {
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };
  const toggleSegment = (id: number) => {
    setDraftSegments((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  // Options come pre-filtered from the API
  const filteredTags = tagsQuery.data ?? [];
  const filteredSegments = segmentsQuery.data ?? [];

  // Count active filters (from URL state, not draft)
  const activeFilterCount = useMemo(() => {
    return (
      currentStatus.length +
      currentTypes.length +
      currentMessages.length +
      currentTagIds.length +
      currentSegmentIds.length
    );
  }, [currentStatus, currentTypes, currentMessages, currentTagIds, currentSegmentIds]);

  // Apply filters to URL
  const handleApply = useCallback(() => {
    if (saveEnabled) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: true,
          filters: {
            status: draftStatus,
            types: draftTypes,
            messages: draftMessages,
            tags: draftTags,
            segments: draftSegments,
          },
        }),
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    startTransition(() => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          status: serializeCsvIds(draftStatus),
          types: serializeCsvStrings(draftTypes),
          messages: serializeCsvStrings(draftMessages),
          tags: serializeCsvIds(draftTags),
          segments: serializeCsvIds(draftSegments),
          page: 1,
        }),
      } as never);
    });
    setOpen(false);
  }, [navigate, draftStatus, draftTypes, draftMessages, draftTags, draftSegments, saveEnabled]);

  // Clear all filters and immediately apply
  const handleClear = useCallback(() => {
    setDraftStatus([]);
    setDraftTypes([]);
    setDraftMessages([]);
    setDraftTags([]);
    setDraftSegments([]);
    setSaveEnabled(false);
    localStorage.removeItem(STORAGE_KEY);
    startTransition(() => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          status: '',
          types: '',
          messages: '',
          tags: '',
          segments: '',
          page: 1,
        }),
      } as never);
    });
    setOpen(false);
  }, [navigate]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs font-normal">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('campaigns.moreFilters', 'Mais filtros')}
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
          {/* Status Section */}
          <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                {t('campaigns.filterStatus', 'Status')}
                {draftStatus.length > 0 && (
                  <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-[10px]">
                    {draftStatus.length}
                  </Badge>
                )}
              </span>
              {statusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 px-4 pb-3">
                {STATUS_ENTRIES.map(([code, labelKey]) => {
                  const numCode = Number(code) as CampaignStatus;
                  const checked = draftStatus.includes(numCode);
                  return (
                    <label
                      key={code}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleStatus(numCode)} />
                      <span>{t(labelKey as never)}</span>
                    </label>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t" />

          {/* Type Section */}
          <Collapsible open={typesOpen} onOpenChange={setTypesOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                {t('campaigns.filterTypes', 'Tipo')}
                {draftTypes.length > 0 && (
                  <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-[10px]">
                    {draftTypes.length}
                  </Badge>
                )}
              </span>
              {typesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 px-4 pb-3">
                {TYPE_OPTIONS.map((opt) => {
                  const checked = draftTypes.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleType(opt.value)} />
                      <span>{t(opt.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t" />

          {/* Channels Section */}
          <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                {t('campaigns.filterChannels', 'Canais')}
                {draftMessages.length > 0 && (
                  <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-[10px]">
                    {draftMessages.length}
                  </Badge>
                )}
              </span>
              {channelsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 px-4 pb-3">
                {CHANNEL_OPTIONS.map((opt) => {
                  const checked = draftMessages.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleMessage(opt.value)} />
                      <span>{t(opt.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t" />

          {/* Tags Section */}
          <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
            <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                {t('campaigns.filterTags', 'Tags')}
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
                {t('campaigns.filterSegments', 'Segmentos')}
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
        </div>

        {/* Footer: Save toggle + Clear + Apply */}
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <div className="mr-auto flex items-center gap-2">
            <Switch id="save-filter" checked={saveEnabled} onCheckedChange={setSaveEnabled} className="scale-90" />
            <Label htmlFor="save-filter" className="cursor-pointer text-xs font-normal">
              {t('campaigns.filterSave')}
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-xs">
            {t('campaigns.filterClear', 'Limpar')}
          </Button>
          <Button size="sm" onClick={handleApply} className="text-xs">
            {t('campaigns.filterApply', 'Aplicar')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
