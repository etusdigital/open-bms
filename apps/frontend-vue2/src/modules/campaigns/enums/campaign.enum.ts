export enum StatusCampaignEnum {
  Draft = 0,
  Scheduled = 1,
  Sending = 2,
  Paused = 3,
  Stopped = 4,
  Completed = 5,
  SendingTestAb = 6,
}

export enum StepsRegisterType {
  SETTINGS = 'settings',
  AUDIENCE = 'audience',
  CONTENT = 'content',
  SCHEDULE = 'schedule',
  REVISION = 'revision',
}

export enum CampaignsType {
  SIMPLE = 'simple',
  TESTAB = 'testAB',
  SPLIT = 'split',
  RECURRING = 'recurring',
  TRIGGER = 'trigger',
}

export enum CampaignMessageType {
  EMAIL = 'email',
  WEBPUSH = 'web-push',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  MOBILEPUSH = 'mobile-push',
}

export enum CampaignRecurrenceFrequency {
  DAILY = 1,
  WEEKLY = 2,
  MONTHLY = 3,
}
