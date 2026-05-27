import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  value: number[];
  onChange: (value: number[]) => void;
  options: FilterOption[];
  isLoading?: boolean;
  placeholder: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MultiSelectFilter({
  value,
  onChange,
  options,
  isLoading,
  placeholder,
  emptyMessage,
  className,
  disabled,
  onOpenChange,
}: MultiSelectFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    onOpenChange?.(isOpen);
  };

  const selectedSet = new Set(value);

  const handleSelect = (id: number) => {
    const next = selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(next);
  };

  const selectedCount = value.length;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between text-xs font-normal', className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedCount > 0 ? `${placeholder} (${selectedCount})` : placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('common.search', 'Buscar...')} className="h-8 text-xs" />
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
                  {options.map((option) => {
                    const numValue = Number(option.value);
                    const isSelected = selectedSet.has(numValue);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => handleSelect(numValue)}
                        className="cursor-pointer text-xs"
                      >
                        <div
                          className={cn(
                            'border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                            isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible',
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {selectedCount > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={() => onChange([])} className="justify-center text-center text-xs">
                        {t('contacts.filterClearAll', 'Limpar')}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SelectedFilterBadgesProps {
  value: number[];
  options: FilterOption[];
  onChange: (value: number[]) => void;
}

export function SelectedFilterBadges({ value, options, onChange }: SelectedFilterBadgesProps) {
  if (value.length === 0) return null;

  return (
    <>
      {value.map((id) => {
        const opt = options.find((o) => Number(o.value) === id);
        if (!opt) return null;
        return (
          <Badge key={id} variant="secondary" className="gap-1 text-xs">
            {opt.label}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== id))}
              className="hover:bg-muted ml-0.5 rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </>
  );
}
