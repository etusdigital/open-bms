// ─── Channel Types ───────────────────────────────────────────────────────────

export const CHANNEL_TYPES = [
  { value: 'email', labelKey: 'segments.builder.channels.email' },
  { value: 'web-push', labelKey: 'segments.builder.channels.webPush' },
  { value: 'mobile-push', labelKey: 'segments.builder.channels.mobilePush' },
  { value: 'sms', labelKey: 'segments.builder.channels.sms' },
  { value: 'whatsapp', labelKey: 'segments.builder.channels.whatsapp' },
  { value: 'anyChannel', labelKey: 'segments.builder.channels.anyChannel' },
  { value: 'page_view', labelKey: 'segments.builder.channels.pageView' },
] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number]['value'];

// ─── Actions per Channel ─────────────────────────────────────────────────────

interface ActionOption {
  value: string;
  labelKey: string;
  dbField: string;
  isNegation: boolean;
}

const emailActions: ActionOption[] = [
  {
    value: 'open',
    labelKey: 'segments.builder.actions.open',
    dbField: 'last_open_date',
    isNegation: false,
  },
  {
    value: 'noopen',
    labelKey: 'segments.builder.actions.noopen',
    dbField: 'last_open_date',
    isNegation: true,
  },
  {
    value: 'click',
    labelKey: 'segments.builder.actions.click',
    dbField: 'last_click_date',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'segments.builder.actions.noclick',
    dbField: 'last_click_date',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'segments.builder.actions.send',
    dbField: 'last_sent_date',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'segments.builder.actions.nosend',
    dbField: 'last_sent_date',
    isNegation: true,
  },
];

const pushActions: ActionOption[] = [
  {
    value: 'click',
    labelKey: 'segments.builder.actions.click',
    dbField: 'last_click_date',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'segments.builder.actions.noclick',
    dbField: 'last_click_date',
    isNegation: true,
  },
  {
    value: 'delivered',
    labelKey: 'segments.builder.actions.delivered',
    dbField: 'last_delivered_date',
    isNegation: false,
  },
  {
    value: 'nodelivered',
    labelKey: 'segments.builder.actions.nodelivered',
    dbField: 'last_delivered_date',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'segments.builder.actions.send',
    dbField: 'last_sent_date',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'segments.builder.actions.nosend',
    dbField: 'last_sent_date',
    isNegation: true,
  },
];

const smsActions: ActionOption[] = [
  {
    value: 'delivered',
    labelKey: 'segments.builder.actions.delivered',
    dbField: 'sms_last_delivered',
    isNegation: false,
  },
  {
    value: 'nodelivered',
    labelKey: 'segments.builder.actions.nodelivered',
    dbField: 'sms_last_delivered',
    isNegation: true,
  },
  {
    value: 'click',
    labelKey: 'segments.builder.actions.click',
    dbField: 'sms_last_click',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'segments.builder.actions.noclick',
    dbField: 'sms_last_click',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'segments.builder.actions.send',
    dbField: 'sms_last_sent',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'segments.builder.actions.nosend',
    dbField: 'sms_last_sent',
    isNegation: true,
  },
];

const whatsappActions: ActionOption[] = [
  {
    value: 'open',
    labelKey: 'segments.builder.actions.open',
    dbField: 'whatsapp_last_open',
    isNegation: false,
  },
  {
    value: 'noopen',
    labelKey: 'segments.builder.actions.noopen',
    dbField: 'whatsapp_last_open',
    isNegation: true,
  },
  {
    value: 'delivered',
    labelKey: 'segments.builder.actions.delivered',
    dbField: 'whatsapp_last_delivered',
    isNegation: false,
  },
  {
    value: 'nodelivered',
    labelKey: 'segments.builder.actions.nodelivered',
    dbField: 'whatsapp_last_delivered',
    isNegation: true,
  },
  {
    value: 'click',
    labelKey: 'segments.builder.actions.click',
    dbField: 'whatsapp_last_click',
    isNegation: false,
  },
  {
    value: 'noclick',
    labelKey: 'segments.builder.actions.noclick',
    dbField: 'whatsapp_last_click',
    isNegation: true,
  },
  {
    value: 'send',
    labelKey: 'segments.builder.actions.send',
    dbField: 'whatsapp_last_sent',
    isNegation: false,
  },
  {
    value: 'nosend',
    labelKey: 'segments.builder.actions.nosend',
    dbField: 'whatsapp_last_sent',
    isNegation: true,
  },
];

const pageViewActions: ActionOption[] = [
  {
    value: 'pageview',
    labelKey: 'segments.builder.actions.pageview',
    dbField: 'page_view',
    isNegation: false,
  },
  {
    value: 'nopageview',
    labelKey: 'segments.builder.actions.nopageview',
    dbField: 'page_view',
    isNegation: true,
  },
];

export const ACTIONS_BY_CHANNEL: Record<string, ActionOption[]> = {
  email: emailActions,
  'web-push': pushActions,
  'mobile-push': pushActions,
  sms: smsActions,
  whatsapp: whatsappActions,
  page_view: pageViewActions,
  anyChannel: [], // no actions for anyChannel
};

export function isNegationAction(channelType: string, actionValue: string): boolean {
  const actions = ACTIONS_BY_CHANNEL[channelType] ?? [];
  return actions.find((a) => a.value === actionValue)?.isNegation ?? false;
}

export function getDbFieldForAction(channelType: string, actionValue: string): string | undefined {
  const actions = ACTIONS_BY_CHANNEL[channelType] ?? [];
  return actions.find((a) => a.value === actionValue)?.dbField;
}

// ─── Comparison Operators ────────────────────────────────────────────────────

export const COMPARISON_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '>', labelKey: 'segments.builder.operators.greaterThan' },
  { value: '>=', labelKey: 'segments.builder.operators.greaterOrEqual' },
  { value: '<', labelKey: 'segments.builder.operators.lessThan' },
  { value: '<=', labelKey: 'segments.builder.operators.lessOrEqual' },
] as const;

export const TEXT_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '!=', labelKey: 'segments.builder.operators.notEqual' },
  { value: 'iLike', labelKey: 'segments.builder.operators.contains' },
] as const;

export const NUMBER_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '!=', labelKey: 'segments.builder.operators.notEqual' },
  { value: '>', labelKey: 'segments.builder.operators.greaterThan' },
  { value: '>=', labelKey: 'segments.builder.operators.greaterOrEqual' },
  { value: '<', labelKey: 'segments.builder.operators.lessThan' },
  { value: '<=', labelKey: 'segments.builder.operators.lessOrEqual' },
] as const;

// DATE_OPERATORS same as NUMBER_OPERATORS
export const DATE_OPERATORS = NUMBER_OPERATORS;

// ─── Period Options ──────────────────────────────────────────────────────────

export const PERIOD_OPTIONS_BASE = [
  { value: '0', labelKey: 'segments.builder.periods.today' },
  { value: '1', labelKey: 'segments.builder.periods.yesterday' },
  { value: '7', labelKey: 'segments.builder.periods.last7Days' },
  { value: '15', labelKey: 'segments.builder.periods.last15Days' },
  { value: 'all', labelKey: 'segments.builder.periods.anyTime' },
  { value: 'custom', labelKey: 'segments.builder.periods.custom' },
] as const;

/** Automation state: no "all" option, max 90 custom days */
export const PERIOD_OPTIONS_AUTOMATION = [
  { value: '0', labelKey: 'segments.builder.periods.today' },
  { value: '1', labelKey: 'segments.builder.periods.yesterday' },
  { value: '7', labelKey: 'segments.builder.periods.last7Days' },
  { value: '15', labelKey: 'segments.builder.periods.last15Days' },
  { value: 'custom', labelKey: 'segments.builder.periods.custom' },
] as const;

/** Custom event: extended period options */
export const PERIOD_OPTIONS_CUSTOM_EVENT = [
  { value: '0', labelKey: 'segments.builder.periods.today' },
  { value: '1', labelKey: 'segments.builder.periods.yesterday' },
  { value: '7', labelKey: 'segments.builder.periods.last7Days' },
  { value: '15', labelKey: 'segments.builder.periods.last15Days' },
  { value: 'date', labelKey: 'segments.builder.periods.date' },
  { value: 'range', labelKey: 'segments.builder.periods.range' },
  { value: 'custom', labelKey: 'segments.builder.periods.custom' },
  { value: 'current_week', labelKey: 'segments.builder.periods.currentWeek' },
  { value: 'last_week', labelKey: 'segments.builder.periods.lastWeek' },
] as const;

export const MAX_CUSTOM_DAYS_DEFAULT = 180;
export const MAX_CUSTOM_DAYS_AUTOMATION = 90;

export const WEEKDAY_OPTIONS = [
  { value: '1', labelKey: 'segments.builder.weekdays.monday' },
  { value: '2', labelKey: 'segments.builder.weekdays.tuesday' },
  { value: '3', labelKey: 'segments.builder.weekdays.wednesday' },
  { value: '4', labelKey: 'segments.builder.weekdays.thursday' },
  { value: '5', labelKey: 'segments.builder.weekdays.friday' },
  { value: '6', labelKey: 'segments.builder.weekdays.saturday' },
  { value: '0', labelKey: 'segments.builder.weekdays.sunday' },
] as const;

// ─── Page View Operators ─────────────────────────────────────────────────────

export const PAGE_VIEW_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.pageView.exactUrl' },
  { value: 'iLike', labelKey: 'segments.builder.pageView.contains' },
] as const;

// ─── User Field Definitions ──────────────────────────────────────────────────

export const USER_FIELDS = [
  { value: 'created_at_date', labelKey: 'segments.builder.userFields.entry' },
  { value: 'last_automation_date', labelKey: 'segments.builder.userFields.automationEntry' },
  { value: 'email_provider', labelKey: 'segments.builder.userFields.emailProvider' },
  {
    value: 'communication_channels',
    labelKey: 'segments.builder.userFields.communicationChannels',
  },
  { value: 'last_vertical_type', labelKey: 'segments.builder.userFields.lastVerticalType' },
  { value: 'is_email_deliverable', labelKey: 'segments.builder.userFields.emailDeliverable' },
] as const;

export const USER_FIELD_ENTRY_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '!=', labelKey: 'segments.builder.operators.notEqual' },
  { value: '>', labelKey: 'segments.builder.operators.greaterThan' },
  { value: '>=', labelKey: 'segments.builder.operators.greaterOrEqual' },
  { value: '<', labelKey: 'segments.builder.operators.lessThan' },
  { value: '<=', labelKey: 'segments.builder.operators.lessOrEqual' },
  { value: '-', labelKey: 'segments.builder.userFields.lastDays' },
] as const;

export const EMAIL_PROVIDERS = [
  { value: 'Gmail', labelKey: 'Gmail' },
  { value: 'Microsoft', labelKey: 'Microsoft' },
  { value: 'Yahoo', labelKey: 'Yahoo' },
  { value: 'iCloud', labelKey: 'iCloud' },
  { value: 'Other', labelKey: 'segments.builder.userFields.other' },
] as const;

export const COMMUNICATION_CHANNELS = [
  { value: 'has_email', labelKey: 'segments.builder.commChannels.email' },
  { value: 'has_phone', labelKey: 'segments.builder.commChannels.phone' },
  { value: 'has_web_push', labelKey: 'segments.builder.commChannels.webPush' },
  { value: 'has_mobile_push', labelKey: 'segments.builder.commChannels.mobilePush' },
  { value: 'has_whatsapp', labelKey: 'segments.builder.commChannels.whatsapp' },
] as const;

export const VERTICAL_TYPES = [
  { value: 'cc', labelKey: 'segments.builder.userFields.creditCard' },
  { value: 'emp', labelKey: 'segments.builder.userFields.loan' },
] as const;

export const HAS_NOT_HAS_OPERATORS = [
  { value: 'true', labelKey: 'segments.builder.operators.has' },
  { value: 'false', labelKey: 'segments.builder.operators.hasNot' },
] as const;

export const EQUAL_NOT_EQUAL_OPERATORS = [
  { value: '=', labelKey: 'segments.builder.operators.equal' },
  { value: '!=', labelKey: 'segments.builder.operators.notEqual' },
] as const;

export const YES_NO_OPERATORS = [
  { value: 'true', labelKey: 'segments.builder.operators.yes' },
  { value: 'false', labelKey: 'segments.builder.operators.no' },
] as const;

// ─── Tag Conditional ─────────────────────────────────────────────────────────

export const TAG_CONDITIONALS = [
  { value: 'in', labelKey: 'segments.builder.tag.has' },
  { value: 'not in', labelKey: 'segments.builder.tag.hasNot' },
] as const;

// ─── Automation State Actions ────────────────────────────────────────────────

export const AUTOMATION_STATE_ACTIONS = [
  { value: 'entered', labelKey: 'segments.builder.automationActions.entered' },
  { value: 'completed', labelKey: 'segments.builder.automationActions.completed' },
  { value: 'running', labelKey: 'segments.builder.automationActions.running' },
] as const;

// ─── Custom Event Conditionals ───────────────────────────────────────────────

export const CUSTOM_EVENT_CONDITIONALS = [
  { value: 'in', labelKey: 'segments.builder.customEvent.has' },
  { value: 'not in', labelKey: 'segments.builder.customEvent.hasNot' },
] as const;
