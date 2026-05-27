import { createContext } from 'react';
import type { StatisticsGeneral, StatisticsTableRow, MessageType, DisplayMode } from '../types';

export type MetricVisibility = Record<string, boolean>;

export interface StatisticsContextValue {
  // Data
  general: StatisticsGeneral | undefined;
  tableData: StatisticsTableRow[];
  isLoading: boolean;
  isFetching: boolean;

  // Display state
  messageType: MessageType;
  displayMode: DisplayMode;
  showPerUser: boolean;
  timezone: string;
  metricVisibility: MetricVisibility;

  // Actions
  setDisplayMode: (mode: DisplayMode) => void;
  setShowPerUser: (show: boolean) => void;
  setMetricVisibility: (visibility: MetricVisibility) => void;
}

export const StatisticsContext = createContext<StatisticsContextValue | null>(null);
