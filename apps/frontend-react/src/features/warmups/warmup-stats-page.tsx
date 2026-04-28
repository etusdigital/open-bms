import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  Mail,
  MousePointerClick,
  Target,
  UserMinus,
  AlertTriangle,
  Hash,
  Percent,
  Rocket,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FormPage } from '@/components/form-page';
import { useWarmup } from './use-warmups';
import { useWarmupStatistics } from './use-warmup-statistics';
import { getPercentage, transformDailyData } from './warmup-stats-utils';
import { WARMUP_LIMITS, WARMUP_COLORS } from './constants';
import { WarmupStatsChart } from './components/warmup-stats-chart';
import { WarmupStatsTable } from './components/warmup-stats-table';

interface WarmupStatsPageProps {
  warmupId: number;
}

function MetricCard({
  icon: Icon,
  title,
  value,
  percentage,
  color,
  isLoading,
}: {
  icon: typeof CheckCircle;
  title: string;
  value?: string;
  percentage?: string;
  color: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-baseline gap-2">
          {percentage !== undefined && (
            <span className="text-xl font-semibold" style={{ color }}>
              {percentage}%
            </span>
          )}
          {value && (
            <span
              className={percentage ? 'text-muted-foreground text-sm' : 'text-xl font-semibold'}
              style={!percentage ? { color } : undefined}
            >
              {value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function WarmupStatsPage({ warmupId }: WarmupStatsPageProps) {
  const { t } = useTranslation();
  const [isPercentage, setIsPercentage] = useState(false);

  const { data: warmup, isLoading: isLoadingWarmup } = useWarmup(warmupId);
  const { data: stats, isLoading: isLoadingStats } = useWarmupStatistics(warmup);

  const isLoading = isLoadingWarmup || isLoadingStats;
  const general = stats?.general;

  const dailyData = useMemo(() => (stats?.daily ? transformDailyData(stats.daily) : []), [stats?.daily]);

  const warmupProgress = useMemo(() => {
    if (!warmup?.target || warmup.target === 0) return 0;
    return Math.min(100, Math.round(((warmup.currentSend ?? 0) / warmup.target) * 100));
  }, [warmup?.currentSend, warmup?.target]);

  const daysPast = useMemo(() => {
    if (!warmup?.createdAt) return 0;
    const diff = Date.now() - new Date(warmup.createdAt).getTime();
    return Math.round(diff / (24 * 60 * 60 * 1000));
  }, [warmup?.createdAt]);

  const warmupLimitsSlice = useMemo(() => [...WARMUP_LIMITS].slice(0, daysPast + 1), [daysPast]);

  return (
    <FormPage.Root>
      <FormPage.Header title={t('warmups.statsTitle')} backTo="/warmups" backLabel={t('warmups.pageTitle')} />

      {isLoadingWarmup ? (
        <Skeleton className="h-5 w-64" />
      ) : warmup ? (
        <p className="text-muted-foreground -mt-4 text-sm">
          {t('warmups.sender')}: {warmup.sender}
        </p>
      ) : null}

      <FormPage.Content className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            icon={CheckCircle}
            title={t('warmups.delivered')}
            value={(general?.delivered ?? 0).toLocaleString()}
            color={WARMUP_COLORS.delivered}
            isLoading={isLoading}
          />
          <MetricCard
            icon={Mail}
            title={t('warmups.open')}
            percentage={general ? getPercentage(general.open, general.delivered) : undefined}
            value={(general?.open ?? 0).toLocaleString()}
            color={WARMUP_COLORS.open}
            isLoading={isLoading}
          />
          <MetricCard
            icon={MousePointerClick}
            title={t('warmups.click')}
            percentage={general ? getPercentage(general.click, general.delivered) : undefined}
            value={(general?.click ?? 0).toLocaleString()}
            color={WARMUP_COLORS.click}
            isLoading={isLoading}
          />
          <MetricCard
            icon={Target}
            title={t('warmups.ctor')}
            percentage={general ? getPercentage(general.click, general.open) : undefined}
            color={WARMUP_COLORS.estimate}
            isLoading={isLoading}
          />
          <MetricCard
            icon={UserMinus}
            title={t('warmups.unsubscribeShort')}
            percentage={general ? getPercentage(general.unsubscribe, general.delivered) : undefined}
            value={(general?.unsubscribe ?? 0).toLocaleString()}
            color={WARMUP_COLORS.unsubscribe}
            isLoading={isLoading}
          />
          <MetricCard
            icon={AlertTriangle}
            title={t('warmups.bounce')}
            percentage={general ? getPercentage(general.bounce, general.delivered) : undefined}
            value={(general?.bounce ?? 0).toLocaleString()}
            color={WARMUP_COLORS.bounce}
            isLoading={isLoading}
          />
        </div>

        {/* Progress Bar */}
        {warmup && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(warmupProgress, 2)}%`,
                      backgroundColor: WARMUP_COLORS.estimate,
                    }}
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap" style={{ color: WARMUP_COLORS.estimate }}>
                  {warmupProgress}%
                </span>
                <Rocket className="h-5 w-5 rotate-45" style={{ color: WARMUP_COLORS.estimate }} />
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {t('warmups.warmupDay', { day: daysPast })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart Toggle */}
        <div className="flex justify-end">
          <div className="inline-flex rounded-md border">
            <Button
              variant={!isPercentage ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setIsPercentage(false)}
              aria-label={t('warmups.numericView')}
              className="rounded-r-none"
            >
              <Hash className="h-4 w-4" />
            </Button>
            <Button
              variant={isPercentage ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setIsPercentage(true)}
              aria-label={t('warmups.percentageView')}
              className="rounded-l-none"
            >
              <Percent className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <Skeleton className="h-[350px] w-full rounded-md" />
        ) : dailyData.length > 0 ? (
          <Card>
            <CardContent className="p-4">
              <WarmupStatsChart
                dailyData={dailyData}
                warmupLimits={warmupLimitsSlice}
                target={warmup?.target ?? 0}
                isPercentage={isPercentage}
              />
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">{t('warmups.noStatistics')}</p>
        )}

        {/* Daily Table */}
        {!isLoading && dailyData.length > 0 && <WarmupStatsTable data={dailyData} />}
      </FormPage.Content>
    </FormPage.Root>
  );
}
