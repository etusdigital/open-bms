import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, isAfter, isBefore } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Shared DateRangePicker: Popover trigger + presets sidebar + range Calendar,
 * with Apply/Cancel footer so the popover stays open while the user adjusts
 * start and end dates. Works with YYYY-MM-DD strings to match URL/search params.
 */

export type DateRangePreset = 'today' | 'yesterday' | 'last7Days' | 'last15Days' | 'last30Days' | 'lastMonth';

export interface DateRangePickerProps {
  /** Start date in YYYY-MM-DD format. Empty string means unset. */
  from: string;
  /** End date in YYYY-MM-DD format. Empty string means unset. */
  to: string;
  /** Called with YYYY-MM-DD strings when the user applies a range. Empty strings when cleared. */
  onChange: (from: string, to: string) => void;
  /** Minimum selectable date (inclusive). Defaults to no lower bound. */
  minDate?: Date;
  /** Maximum selectable date (inclusive). Defaults to today. */
  maxDate?: Date;
  /** Number of calendar months to render side-by-side. Defaults to 1. */
  numberOfMonths?: 1 | 2;
  /** Presets shown in the sidebar. Defaults to all. Pass [] to hide the sidebar. */
  presets?: DateRangePreset[];
  /** Placeholder shown when no range is selected. Defaults to i18n key. */
  placeholder?: string;
  /** Whether the user can clear the range via an X button. Defaults to false. */
  clearable?: boolean;
  /** Popover alignment. Defaults to 'start'. */
  align?: 'start' | 'center' | 'end';
  /** Additional classes for the trigger button. */
  className?: string;
  /** Size of the trigger button. Defaults to 'sm'. */
  size?: 'sm' | 'default';
  /** Test id for the trigger button. Defaults to 'date-range-trigger'. */
  triggerTestId?: string;
}

const DEFAULT_PRESETS: DateRangePreset[] = ['today', 'yesterday', 'last7Days', 'last15Days', 'last30Days', 'lastMonth'];

// Parse a YYYY-MM-DD string as local noon so timezone offsets don't shift the day.
function parseDateStr(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getPresetRange(preset: DateRangePreset, today: Date): { from: Date; to: Date } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const d = subDays(today, 1);
      return { from: d, to: d };
    }
    case 'last7Days':
      return { from: subDays(today, 7), to: today };
    case 'last15Days':
      return { from: subDays(today, 15), to: today };
    case 'last30Days':
      return { from: subDays(today, 30), to: today };
    case 'lastMonth': {
      const m = subMonths(today, 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
  }
}

function clampToBounds(range: { from: Date; to: Date }, minDate?: Date, maxDate?: Date): { from: Date; to: Date } {
  let { from, to } = range;
  if (minDate && isBefore(from, minDate)) from = minDate;
  if (maxDate && isAfter(to, maxDate)) to = maxDate;
  return { from, to };
}

export function DateRangePicker({
  from,
  to,
  onChange,
  minDate,
  maxDate,
  numberOfMonths = 1,
  presets = DEFAULT_PRESETS,
  placeholder,
  clearable = false,
  align = 'start',
  className,
  size = 'sm',
  triggerTestId = 'date-range-trigger',
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const effectiveMax = maxDate ?? today;

  const committedRange = useMemo<DateRange | undefined>(() => {
    const parsedFrom = parseDateStr(from);
    const parsedTo = parseDateStr(to);
    if (parsedFrom && parsedTo) return { from: parsedFrom, to: parsedTo };
    return undefined;
  }, [from, to]);

  const [draftRange, setDraftRange] = useState<DateRange | undefined>(committedRange);

  // Keep draft in sync with committed range when popover is closed
  useEffect(() => {
    if (!open) setDraftRange(committedRange);
  }, [committedRange, open]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) setDraftRange(committedRange);
    },
    [committedRange],
  );

  const commitRange = useCallback(
    (range: { from: Date; to: Date }) => {
      const clamped = clampToBounds(range, minDate, effectiveMax);
      onChange(toDateStr(clamped.from), toDateStr(clamped.to));
      setOpen(false);
    },
    [onChange, minDate, effectiveMax],
  );

  // Presets commit immediately — they're an explicit choice
  const handlePreset = useCallback(
    (preset: DateRangePreset) => {
      commitRange(getPresetRange(preset, today));
    },
    [commitRange, today],
  );

  // Calendar select updates draft only — popover stays open until Apply
  const handleCalendarSelect = useCallback((range: DateRange | undefined) => {
    setDraftRange(range);
  }, []);

  const handleApply = useCallback(() => {
    if (draftRange?.from && draftRange?.to) {
      commitRange({ from: draftRange.from, to: draftRange.to });
    } else if (draftRange?.from) {
      // User picked a single day — treat it as a same-day range
      commitRange({ from: draftRange.from, to: draftRange.from });
    }
  }, [draftRange, commitRange]);

  const handleCancel = useCallback(() => {
    setDraftRange(committedRange);
    setOpen(false);
  }, [committedRange]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraftRange(undefined);
      onChange('', '');
      setOpen(false);
    },
    [onChange],
  );

  const calendarLocale = i18n.language.startsWith('pt') ? ptBR : enUS;
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    [i18n.language],
  );

  const hasRange = Boolean(committedRange?.from && committedRange?.to);
  const displayText =
    hasRange && committedRange?.from && committedRange?.to
      ? `${dateFmt.format(committedRange.from)} - ${dateFmt.format(committedRange.to)}`
      : (placeholder ?? t('common.dateRange.selectDateRange'));

  const applyDisabled = !draftRange?.from;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size}
          data-testid={triggerTestId}
          className={cn(
            'min-w-[220px] justify-start gap-2 text-xs font-normal',
            !hasRange && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{displayText}</span>
          {clearable && hasRange && (
            <X className="ml-auto h-3 w-3 shrink-0 opacity-50 hover:opacity-100" onClick={handleClear} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align} side="bottom" sideOffset={4}>
        <div className="flex flex-col">
          <div className="flex">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={handleCalendarSelect}
              locale={calendarLocale}
              disabled={{ before: minDate ?? new Date(0), after: effectiveMax }}
              startMonth={minDate}
              endMonth={effectiveMax}
              defaultMonth={draftRange?.from ?? (numberOfMonths === 2 ? subMonths(effectiveMax, 1) : effectiveMax)}
              numberOfMonths={numberOfMonths}
              className="p-3"
            />
            {presets.length > 0 && (
              <div className="flex min-w-[140px] flex-col border-l px-1 py-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="hover:bg-muted/50 rounded px-3 py-2 text-left text-xs transition-colors"
                    onClick={() => handlePreset(preset)}
                  >
                    {t(`common.dateRange.preset.${preset}` as never)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <div className="text-muted-foreground text-xs">
              {draftRange?.from && draftRange?.to
                ? `${dateFmt.format(draftRange.from)} - ${dateFmt.format(draftRange.to)}`
                : draftRange?.from
                  ? `${dateFmt.format(draftRange.from)} - …`
                  : t('common.dateRange.pickTwoDates')}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleApply} disabled={applyDisabled}>
                {t('common.dateRange.apply')}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
