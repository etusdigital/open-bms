import { use, useState, useCallback, useEffect, useRef, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePermissions } from '@/hooks/use-permissions';
import { StatisticsContext } from '../context/statistics-context';
import { parseCsvIds, serializeCsvIds } from '../statistics-search-schema';
import type { StatisticsSearchParams } from '../statistics-search-schema';
import {
  useCampaignOptions,
  useAutomationOptions,
  useMessageOptions,
  useTagOptions,
  useSegmentOptions,
  useSenderOptions,
} from '../use-filter-options';
import { FilterCheckboxList } from './filter-checkbox-list';

interface StatisticsFilterPanelProps {
  searchParams: StatisticsSearchParams;
}

interface DraftFilters {
  campaigns: string[];
  automations: string[];
  messages: string[];
  tags: string[];
  segments: string[];
  senders: string[];
  isAllCampaigns: boolean;
  isAllAutomations: boolean;
}

function parseDraft(searchParams: StatisticsSearchParams): DraftFilters {
  return {
    campaigns: searchParams.campaigns === 'all' ? [] : parseCsvIds(searchParams.campaigns).map(String),
    automations: searchParams.automations === 'all' ? [] : parseCsvIds(searchParams.automations).map(String),
    messages: parseCsvIds(searchParams.messages).map(String),
    tags: parseCsvIds(searchParams.tags).map(String),
    segments: parseCsvIds(searchParams.segments).map(String),
    senders: parseCsvIds(searchParams.senders).map(String),
    isAllCampaigns: searchParams.campaigns === 'all',
    isAllAutomations: searchParams.automations === 'all',
  };
}

const EMPTY_OPTIONS: { value: string; label: string }[] = [];

function countActiveFilters(searchParams: StatisticsSearchParams): number {
  let count = 0;
  if (searchParams.campaigns) count++;
  if (searchParams.automations) count++;
  if (searchParams.messages) count++;
  if (searchParams.tags) count++;
  if (searchParams.segments) count++;
  if (searchParams.senders) count++;
  return count;
}

export function StatisticsFilterPanel({ searchParams }: StatisticsFilterPanelProps) {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFilters>(() => parseDraft(searchParams));

  // Search state for each filter section
  const [_campaignSearch, setCampaignSearch] = useState('');
  const [_automationSearch, setAutomationSearch] = useState('');
  const [_messageSearch, setMessageSearch] = useState('');
  const [_tagSearch, setTagSearch] = useState('');
  const [_segmentSearch, setSegmentSearch] = useState('');

  // Debounced search values
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [debouncedSearches, setDebouncedSearches] = useState({
    campaigns: '',
    automations: '',
    messages: '',
    tags: '',
    segments: '',
  });

  const debouncedSetSearch = useCallback((key: string, value: string) => {
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => {
      setDebouncedSearches((prev) => ({ ...prev, [key]: value }));
    }, 300);
  }, []);

  // Clean up pending debounce timers on unmount
  useEffect(() => {
    const ref = debounceRef.current;
    return () => {
      Object.values(ref).forEach(clearTimeout);
    };
  }, []);

  // Fetch options
  const campaignOpts = useCampaignOptions(debouncedSearches.campaigns, ctx.messageType);
  const automationOpts = useAutomationOptions(debouncedSearches.automations);
  const messageOpts = useMessageOptions(debouncedSearches.messages, ctx.messageType);
  const tagOpts = useTagOptions(debouncedSearches.tags);
  const segmentOpts = useSegmentOptions(debouncedSearches.segments);
  const senderOpts = useSenderOptions();

  const activeFilterCount = countActiveFilters(searchParams);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setDraft(parseDraft(searchParams));
      }
      setOpen(isOpen);
    },
    [searchParams],
  );

  const toggleItem = useCallback((key: keyof DraftFilters, value: string) => {
    setDraft((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }, []);

  const handleApply = useCallback(() => {
    startTransition(() => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          campaigns: draft.isAllCampaigns ? 'all' : serializeCsvIds(draft.campaigns.map(Number)),
          automations: draft.isAllAutomations ? 'all' : serializeCsvIds(draft.automations.map(Number)),
          messages: serializeCsvIds(draft.messages.map(Number)),
          tags: serializeCsvIds(draft.tags.map(Number)),
          segments: serializeCsvIds(draft.segments.map(Number)),
          senders: serializeCsvIds(draft.senders.map(Number)),
        }),
      } as never);
    });
    setOpen(false);
  }, [draft, navigate]);

  const handleClearAll = useCallback(() => {
    setDraft({
      campaigns: [],
      automations: [],
      messages: [],
      tags: [],
      segments: [],
      senders: [],
      isAllCampaigns: false,
      isAllAutomations: false,
    });
  }, []);

  const hasChanges =
    draft.campaigns.length > 0 ||
    draft.automations.length > 0 ||
    draft.messages.length > 0 ||
    draft.tags.length > 0 ||
    draft.segments.length > 0 ||
    draft.senders.length > 0 ||
    draft.isAllCampaigns ||
    draft.isAllAutomations;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-secondary hover:bg-secondary/80 min-w-[140px] justify-between gap-2 text-xs font-normal"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('statistics.moreFilters')}
            {activeFilterCount > 0 && (
              <Badge className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 py-0 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex max-h-[70vh] w-[283px] flex-col p-0" align="end" sideOffset={4}>
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y px-4 py-2">
            {can('campaigns:view') && (
              <FilterCheckboxList
                title={t('statistics.campaigns')}
                options={campaignOpts.data ?? EMPTY_OPTIONS}
                selected={draft.campaigns}
                onToggle={(v) => toggleItem('campaigns', v)}
                hasSelectAll
                isAllSelected={draft.isAllCampaigns}
                onToggleAll={() =>
                  setDraft((p) => ({
                    ...p,
                    isAllCampaigns: !p.isAllCampaigns,
                    campaigns: [],
                  }))
                }
                onSearch={(v) => {
                  setCampaignSearch(v);
                  debouncedSetSearch('campaigns', v);
                }}
                isLoading={campaignOpts.isLoading}
              />
            )}

            {can('automations:view') && (
              <FilterCheckboxList
                title={t('statistics.automations')}
                options={automationOpts.data ?? EMPTY_OPTIONS}
                selected={draft.automations}
                onToggle={(v) => toggleItem('automations', v)}
                hasSelectAll
                isAllSelected={draft.isAllAutomations}
                onToggleAll={() =>
                  setDraft((p) => ({
                    ...p,
                    isAllAutomations: !p.isAllAutomations,
                    automations: [],
                  }))
                }
                onSearch={(v) => {
                  setAutomationSearch(v);
                  debouncedSetSearch('automations', v);
                }}
                isLoading={automationOpts.isLoading}
              />
            )}

            {can('messages:view') && (
              <FilterCheckboxList
                title={t('statistics.messages')}
                options={messageOpts.data ?? EMPTY_OPTIONS}
                selected={draft.messages}
                onToggle={(v) => toggleItem('messages', v)}
                onSearch={(v) => {
                  setMessageSearch(v);
                  debouncedSetSearch('messages', v);
                }}
                isLoading={messageOpts.isLoading}
              />
            )}

            {can('audience:tags_view') && (
              <FilterCheckboxList
                title="Tags"
                options={tagOpts.data ?? EMPTY_OPTIONS}
                selected={draft.tags}
                onToggle={(v) => toggleItem('tags', v)}
                onSearch={(v) => {
                  setTagSearch(v);
                  debouncedSetSearch('tags', v);
                }}
                isLoading={tagOpts.isLoading}
              />
            )}

            {can('audience:segments_view') && (
              <FilterCheckboxList
                title={t('statistics.segments')}
                options={segmentOpts.data ?? EMPTY_OPTIONS}
                selected={draft.segments}
                onToggle={(v) => toggleItem('segments', v)}
                onSearch={(v) => {
                  setSegmentSearch(v);
                  debouncedSetSearch('segments', v);
                }}
                isLoading={segmentOpts.isLoading}
              />
            )}

            {can('infra:view') && (
              <FilterCheckboxList
                title={t('statistics.senders')}
                options={senderOpts.data ?? EMPTY_OPTIONS}
                selected={draft.senders}
                onToggle={(v) => toggleItem('senders', v)}
                isLoading={senderOpts.isLoading}
              />
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t px-4 py-3">
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleClearAll} disabled={!hasChanges}>
            {t('statistics.clearAll')}
          </Button>
          <Button size="sm" className="text-xs" onClick={handleApply}>
            {t('statistics.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
