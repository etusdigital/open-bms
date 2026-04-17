export enum StepTypes {
  INTERATION = 'interation',
  CUSTOM_FIELD = 'custom_field',
  TAG = 'tag',
  USER_FIELD = 'user_field',
  AUTOMATION = 'automation',
  CUSTOM_EVENT = 'custom_event',
  AUTOMATION_STATE = 'automation_state',
  LEAD_DATA = 'lead',
}

export enum InterationEmailTypes {
  OPEN = 'last_open_date',
  NOOPEN = 'last_open_date',
  CLICK = 'last_click_date',
  NOCLICK = 'last_click_date',
  SEND = 'last_sent_date',
  NOSEND = 'last_sent_date',
}

export enum InterationPushTypes {
  CLICK = 'last_click_date',
  NOCLICK = 'last_click_date',
  DELIVERED = 'last_delivered_date',
  NODELIVERED = 'last_delivered_date',
  SEND = 'last_sent_date',
  NOSEND = 'last_sent_date',
}

export enum InterationSmsTypes {
  DELIVERED = 'sms_last_delivered',
  NODELIVERED = 'sms_last_delivered',
  CLICK = 'sms_last_click',
  NOCLICK = 'sms_last_click',
  SEND = 'sms_last_sent',
  NOSEND = 'sms_last_sent',
}

export enum InterationWhatsappTypes {
  OPEN = 'whatsapp_last_open',
  NOOPEN = 'whatsapp_last_open',
  DELIVERED = 'whatsapp_last_delivered',
  NODELIVERED = 'whatsapp_last_delivered',
  CLICK = 'whatsapp_last_click',
  NOCLICK = 'whatsapp_last_click',
  SEND = 'whatsapp_last_sent',
  NOSEND = 'whatsapp_last_sent',
}

export enum InterationPageViewTypes {
  PAGEVIEW = 'page_view',
  NOPAGEVIEW = 'page_view'
}

export enum UserFieldsTypes {
  ENTRY = 'created_at_date',
  EMAIL_PROVIDER = 'email_provider',
  COMMUNICATION_CHANNELS = 'communication_channels',
  AUTOMATION_ENTRY = 'last_automation_date',
  EMAIL_DELIVERABLE = 'is_email_deliverable',
  EMAIL_UNSUBSCRIBED = 'is_unsubscribed',
  EMAIL_BOUNCED = 'has_bounced',
  EMAIL_VALID = 'is_valid',
  ACTIVE = 'is_active',
  LAST_VERTICAL_TYPE = 'last_vertical_type',
}

export enum LeadFieldsTypes {
  SOURCE = 'utm_source',
  CAMPAIGN_ID = 'campaign_id',
  LEAD_SOURCE = 'lead_source',
  UTM_CAMPAIGN = 'utm_campaign',
  STATUS = 'status',
  ENGAGED = 'engaged'
}

export interface AddStepType {
  title: string;
  name: string;
}
