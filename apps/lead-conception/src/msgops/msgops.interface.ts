export interface Contact {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  grupo?: string;
  beneficio?: string;
  renda?: string;
  audienceName?: string;
  audienceUrl?: string;
  hashedEmail: string;
  leadTdSscId?: string;
  leadTdClientId?: string;
  campaignIdAquisicao?: string;
  utmCampaignAquisicao?: string;
  recommendationName?: string;
  recommendationUrl?: string;
  quizId?: string;
  leadTdGlobalId?: string;
  utmContent?: string;
}

export interface ContactAutomations {
  status: Status;
  startedAt: number;
  publisher: string;
  hashedEmail: string;
  automationType: string;
  automationId: number;
  automationTitle: string;
}

export enum Status {
  running = 'running',
  canceled = 'canceled',
  completed = 'completed',
  disengaged = 'disengaged',
  duplicate = 'duplicate',
}
