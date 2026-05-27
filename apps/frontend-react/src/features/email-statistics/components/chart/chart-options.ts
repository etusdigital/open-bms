import type { EChartsCoreOption } from 'echarts/core';
import { METRIC_COLORS, PUSH_DELIVERED_COLOR, formatCompact } from '../../constants';
import { formatDateShort } from '../../utils/format-date';
import type { StatisticsTableRow } from '../../types';

// Static config hoisted to module scope (no per-render allocation)
const GRID = { left: 12, right: 20, top: 20, bottom: 50, containLabel: true };
const LEGEND_ICON = 'path://M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z';
const LEGEND = {
  show: true,
  bottom: 0,
  type: 'scroll' as const,
  icon: LEGEND_ICON,
  itemWidth: 10,
  itemHeight: 10,
  textStyle: { fontSize: 12 },
};
const TOOLTIP_BASE = { trigger: 'axis' as const };

function toCategories(data: StatisticsTableRow[], locale: string): string[] {
  return data.map((d) => formatDateShort(d.date, locale));
}

function lineSeries(name: string, color: string, data: number[]) {
  return {
    name,
    type: 'line' as const,
    smooth: 0.3,
    showSymbol: false,
    emphasis: { focus: 'series' as const },
    lineStyle: { width: 2, color },
    itemStyle: { color },
    data,
  };
}

export function buildEmailNumericOption(
  data: StatisticsTableRow[],
  t: (key: string) => string,
  locale: string,
): EChartsCoreOption {
  const categories = toCategories(data, locale);
  return {
    tooltip: TOOLTIP_BASE,
    legend: LEGEND,
    grid: GRID,
    xAxis: { type: 'category', data: categories, boundaryGap: false, axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: (v: number) => formatCompact(v) },
      splitLine: { lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.06)' } },
    },
    series: [
      lineSeries(
        t('statistics.delivered'),
        METRIC_COLORS.delivered,
        data.map((d) => d.delivered),
      ),
      lineSeries(
        t('statistics.open'),
        METRIC_COLORS.open,
        data.map((d) => d.open),
      ),
      lineSeries(
        t('statistics.uniqueOpen'),
        METRIC_COLORS.unique_opens,
        data.map((d) => d.unique_opens),
      ),
      lineSeries(
        t('statistics.click'),
        METRIC_COLORS.click,
        data.map((d) => d.click),
      ),
      lineSeries(
        t('statistics.uniqueClick'),
        METRIC_COLORS.unique_clicks,
        data.map((d) => d.unique_clicks),
      ),
      lineSeries(
        t('statistics.unsubscribe'),
        METRIC_COLORS.unsubscribe,
        data.map((d) => d.unsubscribe),
      ),
      lineSeries(
        t('statistics.bounce'),
        METRIC_COLORS.bounce,
        data.map((d) => d.bounce),
      ),
    ],
  };
}

export function buildEmailPercentageOption(
  data: StatisticsTableRow[],
  t: (key: string) => string,
  locale: string,
): EChartsCoreOption {
  const categories = toCategories(data, locale);
  return {
    tooltip: TOOLTIP_BASE,
    legend: LEGEND,
    grid: GRID,
    xAxis: { type: 'category', data: categories, boundaryGap: false, axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: (v: number) => `${v}%` },
      splitLine: { lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.06)' } },
    },
    series: [
      lineSeries(
        t('statistics.open'),
        METRIC_COLORS.open,
        data.map((d) => d.percentageOpen),
      ),
      lineSeries(
        t('statistics.uniqueOpen'),
        METRIC_COLORS.unique_opens,
        data.map((d) => d.percentageUniqueOpen),
      ),
      lineSeries(
        t('statistics.click'),
        METRIC_COLORS.click,
        data.map((d) => d.percentageClick),
      ),
      lineSeries(
        t('statistics.uniqueClick'),
        METRIC_COLORS.unique_clicks,
        data.map((d) => d.percentageUniqueClick),
      ),
      lineSeries(
        t('statistics.unsubscribe'),
        METRIC_COLORS.unsubscribe,
        data.map((d) => d.percentageUnsubscribe),
      ),
      lineSeries(
        t('statistics.bounce'),
        METRIC_COLORS.bounce,
        data.map((d) => d.percentageBounce),
      ),
    ],
  };
}

export function buildPushNumericOption(
  data: StatisticsTableRow[],
  t: (key: string) => string,
  locale: string,
  isWebPush: boolean,
): EChartsCoreOption {
  const categories = toCategories(data, locale);
  const series = [
    lineSeries(
      t('statistics.sent'),
      METRIC_COLORS.sent,
      data.map((d) => d.sent),
    ),
    lineSeries(
      t('statistics.delivered'),
      PUSH_DELIVERED_COLOR,
      data.map((d) => d.delivered),
    ),
    lineSeries(
      t('statistics.click'),
      METRIC_COLORS.click,
      data.map((d) => d.click),
    ),
  ];
  if (isWebPush) {
    series.push(
      lineSeries(
        t('statistics.close'),
        METRIC_COLORS.close,
        data.map((d) => d.close),
      ),
    );
  }
  return {
    tooltip: TOOLTIP_BASE,
    legend: LEGEND,
    grid: GRID,
    xAxis: { type: 'category', data: categories, boundaryGap: false, axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: (v: number) => formatCompact(v) },
      splitLine: { lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.06)' } },
    },
    series,
  };
}

export function buildPushPercentageOption(
  data: StatisticsTableRow[],
  t: (key: string) => string,
  locale: string,
  isWebPush: boolean,
): EChartsCoreOption {
  const categories = toCategories(data, locale);
  const series = [
    lineSeries(
      t('statistics.delivered'),
      PUSH_DELIVERED_COLOR,
      data.map((d) => d.percentageDelivered),
    ),
    lineSeries(
      t('statistics.click'),
      METRIC_COLORS.click,
      data.map((d) => d.percentageClick),
    ),
  ];
  if (isWebPush) {
    series.push(
      lineSeries(
        t('statistics.close'),
        METRIC_COLORS.close,
        data.map((d) => d.percentageClose),
      ),
    );
  }
  return {
    tooltip: TOOLTIP_BASE,
    legend: LEGEND,
    grid: GRID,
    xAxis: { type: 'category', data: categories, boundaryGap: false, axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: (v: number) => `${v}%` },
      splitLine: { lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.06)' } },
    },
    series,
  };
}

export function buildPerUserOption(
  data: StatisticsTableRow[],
  t: (key: string) => string,
  locale: string,
): EChartsCoreOption {
  const categories = toCategories(data, locale);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: LEGEND,
    grid: { left: 60, right: 60, top: 20, bottom: 50, containLabel: false },
    xAxis: { type: 'category', data: categories, boundaryGap: true, axisLabel: { fontSize: 11 } },
    yAxis: [
      {
        type: 'value',
        position: 'left',
        axisLabel: { fontSize: 11, formatter: (v: number) => formatCompact(v) },
        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.06)' } },
      },
      {
        type: 'value',
        position: 'right',
        min: 0,
        axisLabel: { fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        ...lineSeries(
          t('statistics.baseSize'),
          METRIC_COLORS.unique_user_delivered,
          data.map((d) => d.unique_user_delivered),
        ),
        yAxisIndex: 0,
      },
      {
        ...lineSeries(
          t('statistics.engagedUsers'),
          METRIC_COLORS.unique_user_open,
          data.map((d) => d.unique_user_open),
        ),
        yAxisIndex: 0,
      },
      {
        ...lineSeries(
          t('statistics.dau'),
          METRIC_COLORS.unique_user_click,
          data.map((d) => d.unique_user_click),
        ),
        yAxisIndex: 0,
      },
      {
        name: t('statistics.avgOpenRate'),
        type: 'bar' as const,
        yAxisIndex: 1,
        barMaxWidth: 20,
        itemStyle: { color: METRIC_COLORS.opens_per_contact, borderRadius: [2, 2, 0, 0] },
        data: data.map((d) => d.opens_per_contact),
      },
      {
        name: t('statistics.avgClickRate'),
        type: 'bar' as const,
        yAxisIndex: 1,
        barMaxWidth: 20,
        itemStyle: { color: METRIC_COLORS.clicks_per_contact, borderRadius: [2, 2, 0, 0] },
        data: data.map((d) => d.clicks_per_contact),
      },
      {
        ...lineSeries(
          t('statistics.unsubByBase'),
          METRIC_COLORS.unique_user_unsubscribe,
          data.map((d) => d.unique_user_unsubscribe),
        ),
        yAxisIndex: 0,
      },
    ],
  };
}
