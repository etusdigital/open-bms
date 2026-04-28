import { useCallback, useMemo, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { LayoutGrid } from 'lucide-react';
import { StatisticsFilterPanel } from './statistics-filter-panel';
import { subDays, startOfDay, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/date-range-picker';
import { useAppStore } from '@/stores/app-store';
import type { StatisticsSearchParams } from '../statistics-search-schema';

interface StatisticsFilterBarProps {
  searchParams: StatisticsSearchParams;
  showPerUser: boolean;
  onTogglePerUser: (show: boolean) => void;
  onOpenCustomize: () => void;
}

export function StatisticsFilterBar({
  searchParams,
  showPerUser,
  onTogglePerUser,
  onOpenCustomize,
}: StatisticsFilterBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAppStore((s) => s.auth);
  const isInternal = auth.status === 'authenticated' && auth.account.isInternal;

  // Re-compute daily — key on the date string so it stays stable within a day
  const dateKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dateKey busts the memo when the calendar date changes
  const today = useMemo(() => startOfDay(new Date()), [dateKey]);
  const minDate = useMemo(() => subDays(today, 180), [today]);

  const handleDateChange = useCallback(
    (from: string, to: string) => {
      startTransition(() => {
        void navigate({
          to: '.',
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            startDate: from,
            endDate: to,
          }),
          replace: false,
        } as never);
      });
    },
    [navigate],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePicker
        from={searchParams.startDate ?? ''}
        to={searchParams.endDate ?? ''}
        onChange={handleDateChange}
        minDate={minDate}
        maxDate={today}
        numberOfMonths={2}
        className="bg-secondary hover:bg-secondary/80 min-w-[240px]"
      />

      {isInternal && (
        <div className="flex items-center gap-2">
          <Switch id="per-user-toggle" checked={showPerUser} onCheckedChange={onTogglePerUser} />
          <Label htmlFor="per-user-toggle" className="cursor-pointer text-xs font-normal">
            {t('statistics.perUser')}
          </Label>
        </div>
      )}

      <Button
        variant="outline"
        size="icon"
        className="bg-secondary hover:bg-secondary/80 h-8 w-8"
        onClick={onOpenCustomize}
        title={t('statistics.displayCustomization')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>

      <StatisticsFilterPanel searchParams={searchParams} />
    </div>
  );
}
