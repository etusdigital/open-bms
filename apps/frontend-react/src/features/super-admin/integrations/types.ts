export const INTEGRATIONS_TABS = [
  'sendgridPlatform',
  's3',
  'fcm',
  'emailable',
  'geoip',
] as const;

export type IntegrationsTab = (typeof INTEGRATIONS_TABS)[number];
