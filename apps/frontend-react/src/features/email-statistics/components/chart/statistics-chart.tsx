import { use, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { EChartsCoreOption } from 'echarts/core';
import { Card, CardContent } from '@/components/ui/card';
import { EChartsBase } from '@/components/charts/echarts-base';
import { StatisticsContext } from '../../context/statistics-context';
import type { MetricVisibility } from '../../context/statistics-context';
import { EMAIL_METRICS, PUSH_METRICS, PER_USER_METRICS } from '../../constants';
import {
  buildEmailNumericOption,
  buildEmailPercentageOption,
  buildPushNumericOption,
  buildPushPercentageOption,
  buildPerUserOption,
} from './chart-options';

/** Map metric keys to their translated series names for filtering */
function buildSeriesNameToKeyMap(metrics: typeof EMAIL_METRICS, t: (key: string) => string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of metrics) {
    map.set(t(m.titleKey), m.key);
  }
  return map;
}

function filterSeriesByVisibility(
  option: EChartsCoreOption,
  nameToKey: Map<string, string>,
  visibility: MetricVisibility,
): EChartsCoreOption {
  if (!option.series || !Array.isArray(option.series)) return option;
  const filtered = (option.series as Array<{ name?: string }>).filter((s) => {
    if (!s.name) return true;
    const key = nameToKey.get(s.name);
    if (!key) return true;
    return visibility[key] !== false;
  });
  return { ...option, series: filtered };
}

export function StatisticsChart() {
  const ctx = use(StatisticsContext)!;
  const { t, i18n } = useTranslation();

  const locale = i18n.language;
  const v = ctx.metricVisibility;

  const option = useMemo(() => {
    if (ctx.tableData.length === 0) return null;

    let opt: EChartsCoreOption;
    let metrics: typeof EMAIL_METRICS;

    if (ctx.showPerUser) {
      opt = buildPerUserOption(ctx.tableData, t as never, locale);
      metrics = PER_USER_METRICS;
    } else if (ctx.messageType === 'email') {
      opt =
        ctx.displayMode === 'percentage'
          ? buildEmailPercentageOption(ctx.tableData, t as never, locale)
          : buildEmailNumericOption(ctx.tableData, t as never, locale);
      metrics = EMAIL_METRICS;
    } else {
      const isWebPush = ctx.messageType === 'web-push';
      opt =
        ctx.displayMode === 'percentage'
          ? buildPushPercentageOption(ctx.tableData, t as never, locale, isWebPush)
          : buildPushNumericOption(ctx.tableData, t as never, locale, isWebPush);
      metrics = PUSH_METRICS;
    }

    const nameToKey = buildSeriesNameToKeyMap(metrics, t as never);
    return filterSeriesByVisibility(opt, nameToKey, v);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t identity changes every render; locale captures language changes
  }, [ctx.tableData, ctx.displayMode, ctx.showPerUser, ctx.messageType, locale, v]);

  if (ctx.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="bg-muted h-[345px] w-full animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!option) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <EChartsBase option={option} height={345} />
      </CardContent>
    </Card>
  );
}
