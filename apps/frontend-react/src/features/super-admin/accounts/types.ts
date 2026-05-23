import type { AccountConfig } from '@/types';

export interface SuperAdminAccount {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  accountConfigs?: AccountConfig[];
  createdAt: string;
  updatedAt?: string;
}

export const CHANNEL_CONFIG_NAMES = {
  email: 'email_settings',
  sms: 'sms_settings',
  webPush: 'webpush_settings',
  mobilePush: 'mobilepush_settings',
  whatsapp: 'whatsapp_settings',
} as const;

export type ChannelKey = keyof typeof CHANNEL_CONFIG_NAMES;
