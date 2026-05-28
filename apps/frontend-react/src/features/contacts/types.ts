export type ContactStatus = 'active' | 'inactive' | 'bounced' | 'unsubscribed' | 'blocked';

export interface ContactTag {
  id: number;
  name: string;
  title?: string;
  type?: 'tag' | 'segment';
}

export interface CustomFieldValue {
  customFieldId: number;
  title: string;
  value: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Import types ──────────────────────────────────────────────────

export interface ImportColumnMapping {
  [columnIndex: number]: { type: 'contacts' | 'customField' | 'ignore'; value: string };
}

export interface ImportActions {
  contactUpdate: boolean;
  startAutomation: boolean;
}

export interface ImportPayload {
  contacts: string[][];
  headers: ImportColumnMapping;
  tags: string[];
  actions: ImportActions;
}

export interface Contact {
  id: number;
  uuid?: string;
  name?: string;
  email: string;
  emailProvider?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;

  // Status
  isActive: boolean;
  isUnsubscribed?: boolean;
  isValid?: boolean;
  hasBounced?: boolean;
  isBlocked?: boolean;

  // Channels
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebPush?: boolean;
  hasMobilePush?: boolean;
  hasWhatsapp?: boolean;

  // Engagement dates (email)
  lastSent?: string;
  lastOpen?: string;
  lastClick?: string;

  // Engagement dates (per-channel)
  webPushLastSent?: string;
  webPushLastOpen?: string;
  webPushLastClick?: string;
  smsLastSent?: string;
  smsLastClick?: string;
  whatsappLastSent?: string;
  whatsappLastOpen?: string;
  whatsappLastClick?: string;
  mobPushLastSent?: string;
  mobPushLastOpen?: string;
  mobPushLastClick?: string;

  // Metadata
  customFields?: CustomFieldValue[];
  contactTag?: ContactTag[];
  score?: number;

  // Location
  city?: string;
  region?: string;
  country?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface ContactDashboard {
  total: number;
  subscribedToday: number;
  active: number;
  providers: Record<string, number>;
}

export interface SuppressedContact {
  id: number;
  email: string;
  unsubscribedAt?: string;
  blockedAt?: string;
  isBlocked?: boolean;
}

export interface HistoryItem {
  type: 'automation' | 'message';
  time?: string;
  created_at?: string;
  event?: string;
  automation_title?: string;
  automation_id?: number;
  message_title?: string;
  message_id?: number;
  message_type?: 'email' | 'web-push' | 'mobile-push' | 'sms' | 'whatsapp';
  event_id?: number;
  status?: string;

  // CH `events_logs_v2` top-level columns the API spreads onto the row.
  // Populated for any event that carried them (most notably pageview custom
  // events, which set url + geo + device + utm_campaign on insert).
  url?: string;
  country?: string;
  region?: string;
  city?: string;
  is_mobile?: boolean;
  utm_campaign?: string;

  /**
   * ClickHouse `events_logs_v2.properties` JSON payload as written by the
   * lifecycle producers. For automation events `reason` explains *why* a
   * transition happened (e.g. `'automation set to unique'` when a duplicate
   * was blocked); `automationName` is the slug (we display `automation_title`
   * resolved from PG instead). For `trigger-filtered-out` events `conditions`
   * holds the configured trigger filter (one entry per step) — the same shape
   * `automation.triggers.settings.conditional` carries in PG. For `step`
   * events (`event === 'step'`) `stepType` discriminates which kind of step
   * was traversed and the remaining keys are stepType-specific (see
   * formatStepDetails in contacts-utils.ts). For pageview custom events
   * `url`, `utm_source`, `utm_medium`, `utm_campaign` carry the page +
   * acquisition attribution (mirrored from the top-level columns when set
   * by the tracker SDK).
   */
  properties?: {
    reason?: string;
    automationName?: string;
    conditions?: TriggerCondition[];
    stepType?: string;
    stepId?: number;
    resultLogic?: boolean;
    tags?: string; // JSON-stringified array of tag objects (addTag / removeTag)
    minutes?: number; // wait step
    timer?: number;
    timerType?: string;
    randomIndex?: number;
    randomPercentage?: number;
    messageId?: number;
    messageTitle?: string; // attached server-side by msgops-api for step events
    // pageview-specific (tracker SDK)
    url?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    [key: string]: unknown;
  };
}

/**
 * Per-step shape of the trigger filter configured on an automation.
 * Matches the discriminated union the producer (`tag-process`'s
 * `definedConditional`) walks when building the `eval` expression.
 *
 * All fields are optional because the producer ships heterogeneous shapes per
 * `type`; the renderer ignores fields it doesn't understand. Used for
 * read-only display only — never reconstruct the eval string from this.
 */
export interface TriggerCondition {
  type: 'interation' | 'tag' | 'custom_field' | 'user_field' | 'automation' | 'custom_event' | 'lead';
  conditional?: 'and' | 'or';
  // tag
  tag_id?: number | number[];
  conditional_tag?: 'in' | 'not in';
  // user_field
  user_field_key?: string;
  user_field_value?: string | number;
  conditional_user_field?: string;
  // custom_field
  custom_field_id?: number;
  custom_field_value?: string;
  conditional_custom_field?: string;
  // interation
  event?: string | { name?: string };
  conditional_interation?: 'yes' | 'no';
  time?: string;
  // automation
  user_field_automation?: Array<{ id: number; title?: string }>;
  // catch-all so producer shape drift doesn't crash the renderer
  [key: string]: unknown;
}
