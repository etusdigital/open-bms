import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { FilterOption } from './multi-select-filter';

interface BulkTagPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: FilterOption[];
  isLoading?: boolean;
  onApply: (tagIds: number[]) => void;
  isPending?: boolean;
  label: string;
  icon?: ReactNode;
}

export function BulkTagPicker({
  open,
  onOpenChange,
  options,
  isLoading,
  onApply,
  isPending,
  label,
  icon,
}: BulkTagPickerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const handleApply = () => {
    if (selected.length > 0) {
      onApply(selected);
      setSelected([]);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) setSelected([]);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs" disabled={isPending}>
          {icon}
          {label}
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
                  {t('common.noResults', 'Nenhum resultado')}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const numValue = Number(option.value);
                    const isSelected = selected.includes(numValue);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => toggle(numValue)}
                        className="text-xs"
                      >
                        <Check className={cn('mr-2 h-3 w-3', isSelected ? 'opacity-100' : 'opacity-0')} />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="border-t p-2">
            <Button
              size="sm"
              className="w-full text-xs"
              onClick={handleApply}
              disabled={selected.length === 0 || isPending}
            >
              {t('common.apply', 'Aplicar')} ({selected.length})
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
