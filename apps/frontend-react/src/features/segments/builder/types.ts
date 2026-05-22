// ─── Step Types ──────────────────────────────────────────────────────────────

/** Intentionally misspelled — matches legacy DB format. Do NOT "fix" this. */
export const STEP_TYPE_INTERACTION = 'interation' as const;

export type StepType =
  | 'interation'
  | 'custom_field'
  | 'user_field'
  | 'tag'
  | 'automation_state'
  | 'custom_event'
  | 'lead';

// ─── Per-Step Data Interfaces ────────────────────────────────────────────────

export interface BaseStepData {
  id: string;
  stepConnector?: 'and' | 'or';
}

export interface InteractionStepData extends BaseStepData {
  type: 'interation';
  event_type?: string; // channel: email, web-push, mobile-push, sms, whatsapp, anyChannel, page_view
  event?: string; // action: open, noopen, click, noclick, send, nosend, etc.
  conditional_interation?: 'yes' | 'not';
  message?: 'any' | { id: number; name?: string; title?: string } | null;
  conditional_times_value?: string; // comparison operator: =, >, >=, <, <=
  custom_times_value?: number; // times count
  time?: number | string | null; // period: 0, 1, 7, 15, 'all', 'custom'
  time_custom?: number | null; // custom days count
  page_view_filter?: '=' | 'iLike' | null;
  page_view_value?: string | null;
}

export interface CustomFieldStepData extends BaseStepData {
  type: 'custom_field';
  custom_field_id?: number | null;
  custom_field_name?: string | null;
  custom_field_type?: string | null; // 'text' | 'number' | 'date'
  conditional_custom_field?: string | null; // operator: =, !=, >, >=, <, <=, iLike
  custom_field_value?: string | number | null;
  filter_custom_field?: string | null; // 'text' (field value) or 'compare_fields' (compare 2 fields)
  custom_field_name_2?: string | null; // second field name when filter_custom_field = 'compare_fields'
}

export interface UserFieldStepData extends BaseStepData {
  type: 'user_field';
  user_field_key?: string | null; // field key: created_at_date, email_provider, etc.
  conditional_user_field?: string | null; // operator varies by field
  user_field_value?: string | number | boolean | null;
  user_field_automation?: string | number | null; // for automation entry sub-filter
}

export interface TagStepData extends BaseStepData {
  type: 'tag';
  conditional_tag?: 'in' | 'not in' | null;
  tag_id?: number[] | null;
  tag_info?: Array<{ id: number; name: string; lastCount?: number }> | null;
}

export interface AutomationStateStepData extends BaseStepData {
  type: 'automation_state';
  event?: string | null; // action: entered, completed, running
  automation?: 'any' | { id: number; name?: string; title?: string } | null;
  conditional_times_value?: string | null; // comparison operator
  custom_times_value?: number | null; // times count
  time?: number | string | null; // period
  time_custom?: number | null; // custom days
}

export interface CustomEventStepData extends BaseStepData {
  type: 'custom_event';
  conditional_event_type?: 'in' | 'not in' | null;
  event?: { id: number; name: string } | null;
  conditional_times_value?: string | null; // comparison operator
  custom_times_value?: number | null; // times count
  time?: number | string | null; // period value
  time_type?: string | null; // period type: date, range, custom, current_week, last_week
  time_custom?: number | null; // custom days
  custom_event_date?: string | null; // for date/range period
  custom_event_date_end?: string | null; // for range period
  conditional_week_day_filter?: string | null; // weekday: 0-6
  properties?: Array<{ property: string; value: string }> | null;
}

export interface LeadStepData extends BaseStepData {
  type: 'lead';
  lead_field_key?: string | null;
  conditional_lead_field?: string | null; // '=' | '!='
  lead_field_value?: string | null;
}

export interface UnsupportedStepData extends BaseStepData {
  type: 'unknown';
  /** The actual step type string from the JSON (e.g., 'lead', 'automation') */
  originalType: string;
  raw: Record<string, unknown>;
}

/** Discriminated union of all step data types */
export type StepData =
  | InteractionStepData
  | CustomFieldStepData
  | UserFieldStepData
  | TagStepData
  | AutomationStateStepData
  | CustomEventStepData
  | LeadStepData
  | UnsupportedStepData;

// ─── Builder State ───────────────────────────────────────────────────────────

export interface BuilderCard {
  id: string;
  steps: StepData[];
  /** AND (INTERSECT) / OR (UNION) connector between cards */
  cardConnector?: 'UNION' | 'INTERSECT';
}

export interface BuilderState {
  cards: BuilderCard[];
}

// ─── Builder Actions ─────────────────────────────────────────────────────────

/** Per-step-type update data — prevents cross-type field mixing */
type StepUpdateData<K extends StepType> = Partial<
  Omit<Extract<StepData, { type: K }>, 'type' | 'id' | 'stepConnector'>
>;

export type BuilderAction =
  | { type: 'ADD_CARD' }
  | { type: 'REMOVE_CARD'; cardId: string }
  | { type: 'DUPLICATE_CARD'; cardId: string }
  | { type: 'SET_CARD_CONNECTOR'; cardId: string; value: 'UNION' | 'INTERSECT' }
  | { type: 'ADD_STEP'; cardId: string; stepType: StepType }
  | { type: 'REMOVE_STEP'; cardId: string; stepId: string }
  | { type: 'SET_STEP_CONNECTOR'; cardId: string; stepId: string; value: 'and' | 'or' }
  | UpdateStepAction
  | { type: 'LOAD_STATE'; cards: BuilderCard[] };

/** Typed UPDATE_STEP action — each step type can only receive its own fields */
export type UpdateStepAction =
  | {
      type: 'UPDATE_STEP';
      cardId: string;
      stepId: string;
      stepType: 'interation';
      data: StepUpdateData<'interation'>;
    }
  | {
      type: 'UPDATE_STEP';
      cardId: string;
      stepId: string;
      stepType: 'custom_field';
      data: StepUpdateData<'custom_field'>;
    }
  | {
      type: 'UPDATE_STEP';
      cardId: string;
      stepId: string;
      stepType: 'user_field';
      data: StepUpdateData<'user_field'>;
    }
  | {
      type: 'UPDATE_STEP';
      cardId: string;
      stepId: string;
      stepType: 'tag';
      data: StepUpdateData<'tag'>;
    }
  | {
      type: 'UPDATE_STEP';
      cardId: string;
      stepId: string;
      stepType: 'automation_state';
      data: StepUpdateData<'automation_state'>;
    }
  | {
      type: 'UPDATE_STEP';
      cardId: string;
      stepId: string;
      stepType: 'custom_event';
      data: StepUpdateData<'custom_event'>;
    };

// ─── Serialization Types (Wire Format) ───────────────────────────────────────

/** The Vue 2 wire format: Array<Array<step-object>>. Each inner array is a "card".
 * The first element of non-first cards is { type: 'conditionalCard', value: 'UNION' | 'INTERSECT' }.
 * Steps within a card have { conditional: 'and' | 'or' } on non-first steps. */
export type VueLegacyStep = Record<string, unknown> & { type: string };
export type VueLegacyCard = VueLegacyStep[];
export type VueLegacyStepsFormat = VueLegacyCard[];

// ─── Constants for step creation defaults ────────────────────────────────────

export function createDefaultStep(stepType: StepType): StepData {
  const id = crypto.randomUUID();
  switch (stepType) {
    case 'interation':
      // Seed the times-comparison operator alongside its count. The operator
      // <Select> shows '>=' by default but only writes to state on change —
      // a step left untouched would serialize without it and crash the
      // ClickHouse query with `HAVING COUNT(...) undefined N` (EVO-1423).
      return {
        id,
        type: 'interation',
        event_type: 'email',
        conditional_interation: 'yes',
        custom_times_value: 1,
        conditional_times_value: '>=',
      };
    case 'custom_field':
      return { id, type: 'custom_field' };
    case 'user_field':
      return { id, type: 'user_field' };
    case 'tag':
      return { id, type: 'tag', conditional_tag: 'in', tag_id: [], tag_info: [] };
    case 'automation_state':
      return { id, type: 'automation_state', event: 'entered', custom_times_value: 0, conditional_times_value: '>=' };
    case 'custom_event':
      return { id, type: 'custom_event', conditional_event_type: 'in', custom_times_value: 1, conditional_times_value: '>=' };
    case 'lead':
      return { id, type: 'lead', conditional_lead_field: '=' };
  }
}
