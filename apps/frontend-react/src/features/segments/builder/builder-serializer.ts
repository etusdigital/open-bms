import type {
  BuilderCard,
  StepData,
  StepType,
  UnsupportedStepData,
  VueLegacyStepsFormat,
  VueLegacyStep,
} from './types';
import { ACTIONS_BY_CHANNEL, getDbFieldForAction } from './constants';

const KNOWN_STEP_TYPES: Set<string> = new Set<StepType>([
  'interation',
  'custom_field',
  'user_field',
  'tag',
  'automation_state',
  'lead',
]);

// Internal-only fields that should NOT appear in the wire format
const INTERNAL_FIELDS = new Set(['id', 'stepConnector', 'cardConnector', 'originalType', 'raw']);

// Preset period values that map directly to Select options
const PRESET_TIME_VALUES = new Set([0, 1, 7, 15]);

/**
 * Parse the Vue 2 legacy steps JSON format into typed BuilderCard[].
 * The wire format is Array<Array<step-object>> where:
 * - The first element of non-first cards is { type: 'conditionalCard', value: 'UNION' | 'INTERSECT' }
 * - Non-first steps within a card have { conditional: 'and' | 'or' }
 */
export function parseSteps(input: string | unknown[] | null | undefined): BuilderCard[] {
  if (!input) return [];

  let parsed: VueLegacyStepsFormat;
  if (typeof input === 'string') {
    if (input.trim() === '') return [];
    try {
      parsed = JSON.parse(input);
    } catch {
      return [];
    }
  } else if (Array.isArray(input)) {
    parsed = input as VueLegacyStepsFormat;
  } else {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map((rawCard, cardIndex) => {
    if (!Array.isArray(rawCard)) return { id: crypto.randomUUID(), steps: [] };

    let cardConnector: 'UNION' | 'INTERSECT' | undefined;
    const stepEntries: VueLegacyStep[] = [];

    for (const entry of rawCard) {
      if (entry.type === 'conditionalCard') {
        cardConnector = entry.value as 'UNION' | 'INTERSECT';
      } else {
        stepEntries.push(entry);
      }
    }

    // First card should never have a connector
    if (cardIndex === 0) cardConnector = undefined;

    const steps = stepEntries.map((raw, stepIndex) => {
      const stepConnector = stepIndex > 0 ? (raw.conditional as 'and' | 'or' | undefined) : undefined;
      return parseRawStep(raw, stepConnector);
    });

    return {
      id: crypto.randomUUID(),
      steps,
      cardConnector,
    };
  });
}

function parseRawStep(raw: VueLegacyStep, stepConnector?: 'and' | 'or'): StepData {
  const id = crypto.randomUUID();

  if (!KNOWN_STEP_TYPES.has(raw.type)) {
    // Preserve unknown step types for round-trip fidelity
    return {
      id,
      type: 'unknown',
      originalType: raw.type,
      raw: { ...raw },
      stepConnector,
    } satisfies UnsupportedStepData;
  }

  // Build the step data from raw fields, normalizing time values
  const step: Record<string, unknown> = { id, type: raw.type, stepConnector };

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'conditional') continue; // handled as stepConnector
    if (key === 'type') continue; // already set
    step[key] = normalizeValue(key, value);
  }

  // Post-process interaction steps: convert DB fields → action keys, normalize period
  if (raw.type === 'interation') {
    normalizeInteractionOnParse(step);
  }

  // Post-process tag steps: legacy data carries `lastCount` and may omit `type`,
  // but the backend schema obj_conditional_tag.tag_info uses `count` and requires
  // `type: 'tag' | 'segment'`. Normalize on parse so a roundtrip never re-sends
  // the legacy shape.
  if (raw.type === 'tag') {
    normalizeTagOnParse(step);
  }

  return step as unknown as StepData;
}

function normalizeTagOnParse(step: Record<string, unknown>) {
  const tagInfo = step.tag_info;
  if (!Array.isArray(tagInfo)) return;

  step.tag_info = tagInfo.map((entry) => {
    if (entry === null || typeof entry !== 'object') return entry;
    const e = entry as Record<string, unknown>;
    const rawType = e.type;
    const normalizedType: 'tag' | 'segment' = rawType === 'segment' ? 'segment' : 'tag';
    const count = e.count !== undefined ? e.count : (e.lastCount ?? null);
    return {
      id: e.id,
      name: e.name,
      type: normalizedType,
      count,
    };
  });
}

/**
 * Converts API-stored interaction data to React component format:
 * 1. event: DB field name (e.g., "last_open_date") → action key (e.g., "noopen")
 *    Uses event_type (channel) + conditional_interation (yes/not) to disambiguate
 * 2. time: non-preset numbers (e.g., 10, 30) → "custom" with time_custom = value
 */
function normalizeInteractionOnParse(step: Record<string, unknown>) {
  // Default event_type to 'email' when missing (legacy data omits it)
  if (!step.event_type) {
    step.event_type = 'email';
  }

  const channelType = step.event_type as string;
  const eventDbField = step.event as string | undefined;
  const isNegation = step.conditional_interation === 'not';

  // Convert DB field → action key
  if (channelType && eventDbField) {
    const actions = ACTIONS_BY_CHANNEL[channelType] ?? [];
    // Check if the event is already an action key (not a DB field)
    const isAlreadyActionKey = actions.some((a) => a.value === eventDbField);
    if (!isAlreadyActionKey) {
      // Find the action that matches this DB field + negation
      const match = actions.find((a) => a.dbField === eventDbField && a.isNegation === isNegation);
      if (match) {
        step.event = match.value;
      }
    }
  }

  // Convert non-preset time to custom period
  const time = step.time;
  if (typeof time === 'number' && !PRESET_TIME_VALUES.has(time)) {
    step.time_custom = time;
    step.time = 'custom';
  }
}

function normalizeValue(key: string, value: unknown): unknown {
  // Normalize time values: string numbers become actual numbers
  if (key === 'time' || key === 'time_custom') {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== '') return num;
    }
    return value;
  }
  return value;
}

/**
 * Serialize typed BuilderCard[] back to the Vue 2 legacy JSON format.
 * Produces the exact same structure the backend expects.
 */
export function serializeSteps(cards: BuilderCard[]): VueLegacyStepsFormat {
  return cards.map((card) => {
    const entries: VueLegacyStep[] = [];

    // Add conditionalCard entry for non-first cards
    if (card.cardConnector) {
      entries.push({ type: 'conditionalCard', value: card.cardConnector });
    }

    for (const step of card.steps) {
      entries.push(serializeStep(step));
    }

    return entries;
  });
}

function serializeStep(step: StepData): VueLegacyStep {
  // UnsupportedStepData: restore original format
  if (step.type === 'unknown') {
    const unsupported = step as UnsupportedStepData;
    const restored = { ...unsupported.raw };
    // Restore the stepConnector as 'conditional' field
    if (unsupported.stepConnector) {
      restored.conditional = unsupported.stepConnector;
    }
    return restored as VueLegacyStep;
  }

  // Known step types: strip internal fields, map stepConnector to conditional
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(step)) {
    if (INTERNAL_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;
    output[key] = value;
  }

  // Map stepConnector → conditional
  if (step.stepConnector) {
    output.conditional = step.stepConnector;
  }

  // Defense-in-depth for the times-comparison operator (EVO-1423). New
  // steps already carry '>=' from `createDefaultStep`; this guard backfills
  // legacy steps loaded from the DB that predate that seeding, so a step
  // with a repeated-count condition (custom_times_value > 1) never
  // serializes without the operator. automation_state steps with count
  // 0/1 are not covered here — the query builder defaults their operator
  // to '>=' at generation time.
  if (Number(output.custom_times_value) > 1 && output.conditional_times_value == null) {
    output.conditional_times_value = '>=';
  }

  // Post-process interaction steps: convert action keys → DB fields, denormalize period
  if (step.type === 'interation') {
    normalizeInteractionOnSerialize(output);
  }

  return output as VueLegacyStep;
}

/**
 * Converts React component format back to API storage format:
 * 1. event: action key (e.g., "noopen") → DB field name (e.g., "last_open_date")
 * 2. time: "custom" with time_custom → raw number (e.g., time_custom=10 → time=10)
 */
function normalizeInteractionOnSerialize(output: Record<string, unknown>) {
  const channelType = output.event_type as string | undefined;
  const actionKey = output.event as string | undefined;

  // Convert action key → DB field
  if (channelType && actionKey) {
    const dbField = getDbFieldForAction(channelType, actionKey);
    if (dbField) {
      output.event = dbField;
    }
  }

  // Convert custom period back to raw number
  if (output.time === 'custom' && output.time_custom != null) {
    output.time = output.time_custom;
  }
  // Always remove time_custom — it's an internal UI field, not in the API schema
  delete output.time_custom;
}
