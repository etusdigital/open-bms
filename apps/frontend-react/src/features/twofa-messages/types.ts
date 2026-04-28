export type TwoFAChannel = 'email' | 'sms' | 'whatsapp';

export const TWO_FA_CHANNELS: TwoFAChannel[] = ['email', 'sms', 'whatsapp'];

export const TWO_FA_CHANNEL_LABELS: Record<TwoFAChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

/** Maps a 2FA channel to the API message type filter */
export function toApiType(channel: TwoFAChannel): string {
  return `2FA-${channel}`;
}

/** Maps a channel to the verify statistics API method (uppercase) */
export function toVerifyMethod(channel: TwoFAChannel): string {
  return channel.toUpperCase();
}

/** Lightweight message reference stored inside 2FA config JSON — NOT a full Message entity */
export interface TwoFAMessageRef {
  id: number;
  title: string;
  subject?: string;
  fromName?: string;
  url?: string;
}

export interface TwoFAGroupConfig {
  message: TwoFAMessageRef;
  percentage: number;
}

export interface TwoFASettings {
  email: Record<string, TwoFAGroupConfig[]>;
  sms: Record<string, TwoFAGroupConfig[]>;
  whatsapp: Record<string, TwoFAGroupConfig[]>;
}

export interface TwoFAStatistic {
  date: string;
  method: string;
  group: string;
  countTotal: number;
  countSuccess: number;
  countError: number;
  countVerifyValidated: number;
  countVerifyRejected: number;
}

export interface TwoFAGroupRow {
  groupName: string;
  countSuccess: number;
  countError: number;
  countVerifyValidated: number;
  countVerifyRejected: number;
}
