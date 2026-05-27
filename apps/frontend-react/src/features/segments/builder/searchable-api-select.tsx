import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableApiSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  isLoading?: boolean;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  /** Fixed option shown at the top (e.g., "Any Message") */
  fixedOption?: SelectOption;
}

export function SearchableApiSelect({
  value,
  onValueChange,
  options,
  isLoading,
  onSearchChange,
  placeholder,
  emptyMessage,
  className,
  popoverClassName,
  disabled,
  fixedOption,
}: SearchableApiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = useMemo(() => {
    if (fixedOption && value === fixedOption.value) return fixedOption.label;
    return options.find((o) => o.value === value)?.label ?? '';
  }, [value, options, fixedOption]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    onSearchChange?.(newSearch);
  };

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn('w-[180px] justify-between text-xs font-normal', className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder || t('common.select', 'Selecionar')}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[220px] p-0', popoverClassName)} align="start">
        {/* shouldFilter={false} only when using server-side search (onSearchChange provided).
            Otherwise, cmdk handles client-side filtering by matching on CommandItem's value. */}
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={t('common.search', 'Buscar...')}
            value={search}
            onValueChange={handleSearchChange}
            className="h-8 text-xs"
          />
          <CommandList>
            {isLoading ? (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full rounded" />
                ))}
              </div>
            ) : (
              <>
                <CommandEmpty className="text-muted-foreground py-4 text-center text-xs">
                  {emptyMessage || t('common.noResults', 'Nenhum resultado')}
                </CommandEmpty>
                <CommandGroup>
                  {fixedOption && (
                    <CommandItem
                      value={fixedOption.label}
                      onSelect={() => handleSelect(fixedOption.value)}
                      className="text-xs"
                    >
                      <Check
                        className={cn('mr-2 h-3 w-3', value === fixedOption.value ? 'opacity-100' : 'opacity-0')}
                      />
                      {fixedOption.label}
                    </CommandItem>
                  )}
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      /* Use label as the filter value so cmdk can search by text.
                         The actual ID is passed to onSelect via closure. */
                      value={option.label}
                      onSelect={() => handleSelect(option.value)}
                      className="text-xs"
                    >
                      <Check className={cn('mr-2 h-3 w-3', value === option.value ? 'opacity-100' : 'opacity-0')} />
                      <div>
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-muted-foreground ml-1">({option.description})</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
