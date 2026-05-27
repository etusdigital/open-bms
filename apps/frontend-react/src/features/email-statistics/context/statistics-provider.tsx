import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { StatisticsContext, type StatisticsContextValue, type MetricVisibility } from './statistics-context';
import { useEmailStatistics } from '../use-email-statistics';
import { useAppStore } from '@/stores/app-store';
import { getPercentage } from '../constants';
import type { MessageType, DisplayMode, StatisticsTableRow, StatisticsDaily } from '../types';
import type { StatisticsSearchParams } from '../statistics-search-schema';

const STORAGE_KEY = 'filteredMessageMetrics';

function loadVisibility(): MetricVisibility {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result: MetricVisibility = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'object' && val !== null && 'visible' in val) {
          result[key] = (val as { visible: boolean }).visible;
        } else if (typeof val === 'boolean') {
          result[key] = val;
        }
      }
      return result;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveVisibility(visibility: MetricVisibility) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    /* ignore */
  }
}

function computeTableRow(row: StatisticsDaily): StatisticsTableRow {
  const d = row.delivered || 0;
  const o = row.open || 0;
  const s = row.sent || 0;

  return {
    ...row,
    percentageOpen: getPercentage(row.open, d),
    percentageUniqueOpen: getPercentage(row.unique_opens, d),
    percentageClick: getPercentage(row.click, d),
    percentageUniqueClick: getPercentage(row.unique_clicks, d),
    percentageCtor: getPercentage(row.click, o),
    percentageUto: getPercentage(row.unsubscribe, o),
    percentageUnsubscribe: getPercentage(row.unsubscribe, d),
    percentageBounce: getPercentage(row.bounce, d),
    percentageDelivered: getPercentage(row.delivered, s),
    percentageClose: getPercentage(row.close, d),
    percentageUserOpen: getPercentage(row.unique_user_open, row.unique_user_delivered),
    percentageUserClick: getPercentage(row.unique_user_click, row.unique_user_delivered),
    percentageUserUnsubscribe: getPercentage(row.unique_user_unsubscribe, row.unique_user_delivered),
    percentageUserBounce: getPercentage(row.unique_user_bounce, row.unique_user_delivered),
  };
}

interface StatisticsProviderProps {
  children: ReactNode;
  searchParams: StatisticsSearchParams;
  messageType: MessageType;
}

export function StatisticsProvider({ children, searchParams, messageType }: StatisticsProviderProps) {
  const navigate = useNavigate();
  const timezone = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.timezone : 'UTC'));

  const displayMode = searchParams.displayMode as DisplayMode;
  const showPerUser = searchParams.showPerUser;

  const [metricVisibility, setMetricVisibilityState] = useState<MetricVisibility>(loadVisibility);

  const setDisplayMode = useCallback(
    (mode: DisplayMode) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, displayMode: mode }),
      } as never);
    },
    [navigate],
  );

  const setShowPerUser = useCallback(
    (show: boolean) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, showPerUser: show }),
      } as never);
    },
    [navigate],
  );

  const setMetricVisibility = useCallback((visibility: MetricVisibility) => {
    setMetricVisibilityState(visibility);
    saveVisibility(visibility);
  }, []);

  const query = useEmailStatistics(searchParams, messageType);

  const tableData = useMemo(() => {
    if (!query.data?.daily) return [];
    // Filter out rows with null/empty dates, then sort ascending
    const valid = query.data.daily.filter((row) => !!row.date);
    valid.sort((a, b) => a.date.localeCompare(b.date));
    return valid.map(computeTableRow);
  }, [query.data?.daily]);

  const value = useMemo<StatisticsContextValue>(
    () => ({
      general: query.data?.general,
      tableData,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      messageType,
      displayMode,
      showPerUser,
      timezone,
      metricVisibility,
      setDisplayMode,
      setShowPerUser,
      setMetricVisibility,
    }),
    [
      query.data?.general,
      tableData,
      query.isLoading,
      query.isFetching,
      messageType,
      displayMode,
      showPerUser,
      timezone,
      metricVisibility,
      setDisplayMode,
      setShowPerUser,
      setMetricVisibility,
    ],
  );

  return <StatisticsContext value={value}>{children}</StatisticsContext>;
}
