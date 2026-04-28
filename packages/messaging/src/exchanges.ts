export const EXCHANGES = {
  email: 'bms.email',
  events: 'bms.events',
  leads: 'bms.leads',
  campaigns: 'bms.campaigns',
  triggers: 'bms.triggers',
  push: 'bms.push',
  whatsapp: 'bms.whatsapp',
  sms: 'bms.sms',
  tags: 'bms.tags',
  analytics: 'bms.analytics',
} as const;

export const DLX = 'bms.dlx';

export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];
