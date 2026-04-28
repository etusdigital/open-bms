import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfDay, parseISO, isValid } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MAX_PAST_DAYS = 90;

interface DatePickerFieldProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DatePickerField({ value, onChange, disabled, className }: DatePickerFieldProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const today = startOfDay(new Date());
  const minDate = subDays(today, MAX_PAST_DAYS);

  const selectedDate = value ? parseISO(value) : undefined;
  const isSelectedValid = selectedDate && isValid(selectedDate);
  const locale = i18n.language?.startsWith('pt') ? ptBR : enUS;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-[150px] justify-start text-xs font-normal',
            !isSelectedValid && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {isSelectedValid ? format(selectedDate, 'dd/MM/yyyy') : t('common.select', 'Selecionar')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isSelectedValid ? selectedDate : undefined}
          onSelect={handleSelect}
          disabled={(date) => date > today || date < minDate}
          defaultMonth={isSelectedValid ? selectedDate : today}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerFieldProps {
  startValue: string | null | undefined;
  endValue: string | null | undefined;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  disabled?: boolean;
}

export function DateRangePickerField({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  disabled,
}: DateRangePickerFieldProps) {
  const { t: _t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <DatePickerField value={startValue} onChange={onStartChange} disabled={disabled} />
      <span className="text-muted-foreground text-xs">—</span>
      <DatePickerField value={endValue} onChange={onEndChange} disabled={disabled} />
    </div>
  );
}
