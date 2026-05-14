import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'UTC'];
  }
}

const TIMEZONES = getTimezones();

interface TimezoneComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TimezoneCombobox({ value, onChange, placeholder }: TimezoneComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar fuso horário..." />
          <CommandList className="max-h-60">
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            {TIMEZONES.map((tz) => (
              <CommandItem
                key={tz}
                value={tz}
                onSelect={() => {
                  onChange(tz);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === tz ? 'opacity-100' : 'opacity-0')} />
                {tz}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
