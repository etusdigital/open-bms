import { useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';
import ReactECharts from 'echarts-for-react';
import { Mail, MousePointerClick, UserPlus, Activity } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/date-range-picker';
import { useAutomationStatistics, useAutomationGoalStats } from '../../use-automations';

interface AutomationStatisticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString(i18n.language);
}

function formatShortDate(dateStr: string): string {
  try {
    // Parse as local date to avoid timezone shift (YYYY-MM-DD → UTC midnight → previous day in negative offsets)
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const locale = i18n.language === 'pt-BR' ? ptBR : enUS;
    return format(date, 'd MMM', { locale });
  } catch {
    return dateStr;
  }
}

export function AutomationStatisticsDialog({ open, onOpenChange, automationId }: AutomationStatisticsDialogProps) {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const minDate = useMemo(() => subDays(new Date(), 90), []);
  const maxDate = useMemo(() => new Date(), []);

  const handleDateChange = useCallback((from: string, to: string) => {
    setStartDate(from);
    setEndDate(to);
  }, []);

  const { data: stats, isLoading: statsLoading } = useAutomationStatistics(open ? automationId : 0);
  const { data: goalData = [], isLoading: goalLoading } = useAutomationGoalStats(
    open ? automationId : 0,
    startDate,
    endDate,
  );

  const sortedData = useMemo(() => [...goalData].sort((a, b) => a.date.localeCompare(b.date)), [goalData]);

  const chartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const },
      grid: { left: 40, right: 16, top: 16, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: sortedData.map((d) => formatShortDate(d.date)),
        axisLabel: { fontSize: 11 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { fontSize: 11 },
        minInterval: 1,
      },
      series: [
        {
          name: t('automations.editor.stats.goalReached'),
          type: 'line' as const,
          data: sortedData.map((d) => Number(d.count) || 0),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
        },
      ],
    }),
    [sortedData, t],
  );

  const KPI_CARDS = [
    {
      key: 'unique_open',
      labelKey: 'automations.editor.stats.uniqueOpen',
      icon: Mail,
      value: stats?.unique_open ?? 0,
    },
    {
      key: 'unique_click',
      labelKey: 'automations.editor.stats.uniqueClick',
      icon: MousePointerClick,
      value: stats?.unique_click ?? 0,
    },
    {
      key: 'total_running_today',
      labelKey: 'automations.editor.stats.enteredToday',
      icon: UserPlus,
      value: stats?.total_running_today ?? 0,
    },
    {
      key: 'total_running',
      labelKey: 'automations.editor.stats.running',
      icon: Activity,
      value: stats?.total_running ?? 0,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('automations.editor.stats.title')}</DialogTitle>
        </DialogHeader>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {KPI_CARDS.map((kpi) => (
            <Card key={kpi.key} className="py-2">
              <CardContent className="flex h-full flex-col px-3 py-2.5">
                <div className="flex min-h-[2rem] items-start gap-1.5">
                  <kpi.icon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="text-muted-foreground text-[11px] leading-tight">{t(kpi.labelKey as never)}</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="mt-auto ml-auto h-6 w-16" />
                ) : (
                  <p className="mt-auto text-right text-xl font-bold">{formatNumber(kpi.value)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Goal Chart */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('automations.editor.stats.goalTitle')}</p>
            <DateRangePicker
              from={startDate}
              to={endDate}
              onChange={handleDateChange}
              minDate={minDate}
              maxDate={maxDate}
              numberOfMonths={2}
              align="end"
              placeholder={t('automations.editor.stats.selectDate')}
            />
          </div>

          <div className="h-[250px]">
            {goalLoading ? (
              <Skeleton className="h-full w-full rounded" />
            ) : sortedData.length === 0 ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                {t('automations.editor.stats.noData')}
              </div>
            ) : (
              <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} notMerge />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
