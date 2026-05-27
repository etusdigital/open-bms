export enum CampaignsType {
  SIMPLE = 'simple',
  TESTAB = 'testAB',
  SPLIT = 'split',
  RECURRING = 'recurring',
  TRIGGER = 'trigger',
}

export enum CampaignsMessageType {
  EMAIL = 'email',
  WEB_PUSH = 'web-push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  MOBILE_PUSH = 'mobile-push',
}

export enum CampaignsStatus {
  Draft = 0,
  Scheduled = 1,
  Sending = 2,
  Paused = 3,
  Stopped = 4,
  Completed = 5,
  SendingTestAb = 6,
}

export interface CampaignRecurrenceSettings {
  date: Date;
  interval: number;
  frequency: number;
  weekDays: number[];
  hasExpiration: boolean;
  untilDate: Date;
  untilSend: number;
  firstSentDate?: Date;
  lastSentDate?: Date;
}

export enum CampaignRecurrenceFrequency {
  daily = 1,
  weekly = 2,
  monthly = 3,
}
