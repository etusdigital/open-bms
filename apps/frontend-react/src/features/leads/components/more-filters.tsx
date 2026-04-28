import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Filter, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMAIL_PROVIDER_OPTIONS, UTM_SOURCE_OPTIONS, type LeadsFilters } from '../types';

interface MoreFiltersProps {
  filters: LeadsFilters;
  onChange: (filters: LeadsFilters) => void;
}

const EMPTY_FILTERS: LeadsFilters = {
  email_provider: [],
  utm_source: [],
  utm_campaign: '',
  source_url: '',
};

function countActiveFilters(filters: LeadsFilters): number {
  return (
    filters.email_provider.length +
    filters.utm_source.length +
    (filters.utm_campaign ? 1 : 0) +
    (filters.source_url ? 1 : 0)
  );
}

export function MoreFilters({ filters, onChange }: MoreFiltersProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<LeadsFilters>(EMPTY_FILTERS);

  const activeCount = countActiveFilters(filters);

  const handleOpen = (next: boolean) => {
    if (next) {
      setPending({ ...filters });
    }
    setOpen(next);
  };

  const toggleCheckbox = (field: 'email_provider' | 'utm_source', value: string) => {
    setPending((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const handleApply = () => {
    onChange(pending);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(EMPTY_FILTERS);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          <span>{t('leads.moreFilters')}</span>
          {activeCount > 0 && (
            <Badge variant="default" className="ml-0.5 h-5 min-w-5 justify-center px-1.5">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-[400px] overflow-y-auto">
          {/* Email Provider */}
          <FilterSection title={t('leads.filter.emailProvider')} count={pending.email_provider.length}>
            {EMAIL_PROVIDER_OPTIONS.map((option) => (
              <label key={option} className="hover:bg-accent flex cursor-pointer items-center gap-2 px-4 py-1 text-sm">
                <Checkbox
                  checked={pending.email_provider.includes(option)}
                  onCheckedChange={() => toggleCheckbox('email_provider', option)}
                />
                {option}
              </label>
            ))}
          </FilterSection>

          {/* UTM Source */}
          <FilterSection title={t('leads.filter.utmSource')} count={pending.utm_source.length}>
            {UTM_SOURCE_OPTIONS.map((option) => (
              <label key={option} className="hover:bg-accent flex cursor-pointer items-center gap-2 px-4 py-1 text-sm">
                <Checkbox
                  checked={pending.utm_source.includes(option)}
                  onCheckedChange={() => toggleCheckbox('utm_source', option)}
                />
                {option}
              </label>
            ))}
          </FilterSection>

          {/* UTM Campaign */}
          <FilterSection title={t('leads.filter.utmCampaign')} count={pending.utm_campaign ? 1 : 0}>
            <div className="flex items-center gap-2 px-4 py-1">
              <Search className="text-muted-foreground h-4 w-4 shrink-0" />
              <Input
                value={pending.utm_campaign}
                onChange={(e) => setPending((prev) => ({ ...prev, utm_campaign: e.target.value }))}
                className="h-7 text-sm"
                placeholder={t('leads.filter.utmCampaignPlaceholder')}
              />
            </div>
          </FilterSection>

          {/* Source URL */}
          <FilterSection title={t('leads.filter.sourceUrl')} count={pending.source_url ? 1 : 0}>
            <div className="flex items-center gap-2 px-4 py-1">
              <Search className="text-muted-foreground h-4 w-4 shrink-0" />
              <Input
                value={pending.source_url}
                onChange={(e) => setPending((prev) => ({ ...prev, source_url: e.target.value }))}
                className="h-7 text-sm"
                placeholder={t('leads.filter.sourceUrlPlaceholder')}
              />
            </div>
          </FilterSection>
        </div>

        {countActiveFilters(pending) > 0 && (
          <div className="flex items-center justify-end gap-2 border-t p-2">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              {t('leads.clear')}
            </Button>
            <Button size="sm" onClick={handleApply}>
              {t('leads.apply')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between border-b px-3 py-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          {title}
          {count > 0 && (
            <Badge variant="default" className="h-5 min-w-5 justify-center px-1.5">
              {count}
            </Badge>
          )}
        </span>
        <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="py-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}
