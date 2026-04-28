import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterCheckboxListProps {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  hasSelectAll?: boolean;
  isAllSelected?: boolean;
  onToggleAll?: () => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
}

export function FilterCheckboxList({
  title,
  options,
  selected,
  onToggle,
  hasSelectAll,
  isAllSelected,
  onToggleAll,
  onSearch,
  isLoading,
}: FilterCheckboxListProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (onSearch || !search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search, onSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      onSearch?.(value);
    },
    [onSearch],
  );

  const hasActiveFilters = isAllSelected || selected.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:text-primary flex w-full items-center justify-between py-2.5 text-sm font-medium transition-colors">
        <span className={hasActiveFilters ? 'text-primary' : ''}>
          {title}
          {selected.length > 0 && !isAllSelected && (
            <span className="bg-primary text-primary-foreground ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {selected.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-2">
          <div className="relative mb-2">
            <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('statistics.search')}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="max-h-[160px] overflow-y-auto">
            <div className="space-y-0.5">
              {hasSelectAll && onToggleAll && (
                <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs">
                  <Checkbox
                    checked={!!isAllSelected}
                    onCheckedChange={onToggleAll}
                    disabled={selected.length > 0 && !isAllSelected}
                  />
                  <span className={selected.length > 0 && !isAllSelected ? 'text-muted-foreground' : ''}>
                    {t('statistics.allItems', { entity: title })}
                  </span>
                </label>
              )}

              {isLoading && <p className="text-muted-foreground py-2 text-center text-xs">{t('statistics.loading')}</p>}

              {filteredOptions.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggle(opt.value)}
                      disabled={!!isAllSelected}
                    />
                    <span className={isAllSelected ? 'text-muted-foreground' : 'truncate'}>{opt.label}</span>
                  </label>
                );
              })}

              {!isLoading && filteredOptions.length === 0 && (
                <p className="text-muted-foreground py-2 text-center text-xs">{t('statistics.noResults')}</p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
