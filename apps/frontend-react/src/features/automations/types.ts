import type { ApiStep, FlowLayout } from './editor/types';

export interface Automation {
  id: number;
  title: string;
  description?: string;
  type: string;
  isActive: boolean;
  isRateLimit: boolean;
  stepId: number;
  steps?: ApiStep;
  stepsCount?: number;
  verticalType?: string;
  target?: string;
  labels?: Array<{ id: number; name: string }>;
  flowLayout?: FlowLayout | null;
  createdAt?: string;
  updatedAt?: string;
}
