import { Suspense, lazy, use, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfDay } from 'date-fns';
import { ListPage } from '@/components/list-page';
import { Card, CardContent } from '@/components/ui/card';
import { StatisticsProvider } from './context/statistics-provider';
import { StatisticsContext } from './context/statistics-context';
import { MessageTypeTabs } from './components/message-type-tabs';
import { StatisticsFilterBar } from './components/statistics-filter-bar';
import { ChartTypeToggle } from './components/chart-type-toggle';
import { CustomizeMetricsDialog } from './components/customize-metrics-dialog';
import { EmailNumericCards } from './components/cards/email-numeric-cards';
import { PushCards } from './components/cards/push-cards';
import { StatisticsTable } from './components/table/statistics-table';
import type { MessageType } from './types';
import type { StatisticsSearchParams } from './statistics-search-schema';

const LazyStatisticsChart = lazy(() =>
  import('./components/chart/statistics-chart').then((m) => ({ default: m.StatisticsChart })),
);

function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="bg-muted h-[345px] w-full animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

interface EmailStatisticsPageProps {
  searchParams: StatisticsSearchParams;
}

/** Fill in default date range (last 30 days) if not present in URL */
function useParamsWithDefaults(searchParams: StatisticsSearchParams): StatisticsSearchParams {
  // Stable per-day string — avoids creating a new Date() on every render
  const [fallbackDate] = useState(() => ({
    start: format(subDays(startOfDay(new Date()), 30), 'yyyy-MM-dd'),
    end: format(startOfDay(new Date()), 'yyyy-MM-dd'),
  }));

  return useMemo(() => {
    if (searchParams.startDate && searchParams.endDate) return searchParams;
    return {
      ...searchParams,
      startDate: searchParams.startDate || fallbackDate.start,
      endDate: searchParams.endDate || fallbackDate.end,
    };
  }, [searchParams, fallbackDate]);
}

export default function EmailStatisticsPage({ searchParams }: EmailStatisticsPageProps) {
  const effectiveParams = useParamsWithDefaults(searchParams);
  const messageType = effectiveParams.channel as MessageType;

  return (
    <StatisticsProvider searchParams={effectiveParams} messageType={messageType}>
      <StatisticsContent searchParams={effectiveParams} />
    </StatisticsProvider>
  );
}

function StatisticsContent({ searchParams }: EmailStatisticsPageProps) {
  const { t } = useTranslation();
  const ctx = use(StatisticsContext)!;
  const [customizeOpen, setCustomizeOpen] = useState(false);

  return (
    <ListPage.Root>
      <ListPage.Header title={t('statistics.pageTitle')} />

      <ListPage.Toolbar>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <MessageTypeTabs activeType={ctx.messageType} />
          <StatisticsFilterBar
            searchParams={searchParams}
            showPerUser={ctx.showPerUser}
            onTogglePerUser={ctx.setShowPerUser}
            onOpenCustomize={() => setCustomizeOpen(true)}
          />
        </div>
      </ListPage.Toolbar>

      <div className="space-y-6">
        {!ctx.showPerUser && (ctx.messageType === 'email' ? <EmailNumericCards /> : <PushCards />)}

        <ChartTypeToggle />

        <Suspense fallback={<ChartSkeleton />}>
          <LazyStatisticsChart />
        </Suspense>

        <StatisticsTable />
      </div>

      <CustomizeMetricsDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </ListPage.Root>
  );
}
