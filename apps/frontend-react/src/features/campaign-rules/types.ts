export interface CampaignRule {
  id: number;
  name: string;
  description: string;
  weekDays: number[];
  accountId?: number;
  configs?: CampaignConfig[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CampaignConfig {
  id: number;
  name: string;
  description: string;
  configs: Record<string, unknown>;
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}
