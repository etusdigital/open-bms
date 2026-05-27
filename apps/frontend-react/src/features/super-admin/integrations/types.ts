export const INTEGRATIONS_TABS = [
  'sendgridPlatform',
  's3',
  'fcm',
  'geoip',
  'whatsappMeta',
  'whatsappHub',
] as const;

export type IntegrationsTab = (typeof INTEGRATIONS_TABS)[number];
