import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useLabelsAll } from '../use-messages';

interface LabelMultiSelectProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export function LabelMultiSelect({ selectedIds, onChange }: LabelMultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const labelsQuery = useLabelsAll();
  const labels = labelsQuery.data ?? [];

  const toggleLabel = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {selectedIds.length > 0
              ? t('messages.labelsSelected', { count: selectedIds.length })
              : t('messages.selectLabels')}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('common.search')} />
            <CommandList>
              <CommandEmpty>{t('common.noResults')}</CommandEmpty>
              <CommandGroup>
                {labels.map((label) => (
                  <CommandItem key={label.id} value={label.name} onSelect={() => toggleLabel(label.id)}>
                    <Check
                      className={cn('mr-2 h-4 w-4', selectedIds.includes(label.id) ? 'opacity-100' : 'opacity-0')}
                    />
                    {label.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => (
            <Badge key={label.id} variant="secondary" className="text-xs" data-testid="label-badge">
              {label.name}
              <button
                type="button"
                className="hover:text-destructive ml-1"
                data-testid="label-badge-remove"
                onClick={() => toggleLabel(label.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
