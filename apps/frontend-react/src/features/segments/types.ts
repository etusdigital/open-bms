export type SegmentStatus = 'active' | 'inactive' | 'reactivating';

export const SEGMENT_STATUSES: SegmentStatus[] = ['active', 'inactive', 'reactivating'];

export interface SegmentStep {
  type: string;
  conditional?: 'and' | 'or';
  [key: string]: unknown;
}

export interface SegmentCard {
  steps: SegmentStep[];
  conditional?: 'UNION' | 'INTERSECT';
}

export interface Segment {
  id: number;
  name: string;
  description?: string;
  type: string;
  status?: SegmentStatus;
  steps?: string;
  query?: string;
  recurrence?: number;
  contactsLimit?: number | null;
  addBounced?: boolean;
  addUnsubscribed?: boolean;
  addInvalid?: boolean;
  isRealTimeSegment?: boolean;
  isClickhouseSegment?: boolean;
  lastCount?: number;
  lastCountEmail?: number;
  lastCountWebPush?: number;
  lastCountMobilePush?: number;
  lastCountPhone?: number;
  lastCountWhatsapp?: number;
  lastRunDate?: string;
  isProcessing?: boolean;
  hasFinishedProcessing?: boolean;
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}
