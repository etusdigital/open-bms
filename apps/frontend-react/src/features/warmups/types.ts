export type WarmupStatus = 'notStarted' | 'running' | 'transferring' | 'finished' | 'deactivated';

export const WARMUP_STATUSES: WarmupStatus[] = ['notStarted', 'running', 'transferring', 'finished', 'deactivated'];

export interface Warmup {
  id: number;
  accountId: number;
  targetAccountId: number;
  sender: string;
  ippool: string;
  replyTo?: string;
  target: number;
  campaignId?: number;
  targetSegmentId?: number;
  currentSend?: number;
  lastSentAt?: string;
  status?: WarmupStatus;
  type: string;
  stage?: number | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  account?: { id: number; name: string };
  targetAccount?: { id: number; name: string };
}

export interface WarmupStatisticsGeneral {
  delivered: number;
  open: number;
  click: number;
  bounce: number;
  unsubscribe: number;
  sent: number;
}

export interface WarmupStatisticsDaily {
  date: string;
  delivered: number;
  open: number;
  click: number;
  bounce: number;
  unsubscribe: number;
  sent: number;
}

export interface WarmupStatisticsResponse {
  general: WarmupStatisticsGeneral;
  daily: WarmupStatisticsDaily[];
}

export interface WarmupDailyTableRow extends WarmupStatisticsDaily {
  formattedDate: string;
  percentageOpen: string;
  percentageClick: string;
  percentageCtor: string;
  percentageUto: string;
  percentageUnsubscribe: string;
  percentageBounce: string;
}

export const WARMUP_STATUS_LABELS: Record<WarmupStatus, string> = {
  notStarted: 'warmups.statusNotStarted',
  running: 'warmups.statusRunning',
  transferring: 'warmups.statusTransferring',
  finished: 'warmups.statusFinished',
  deactivated: 'warmups.statusDeactivated',
};
