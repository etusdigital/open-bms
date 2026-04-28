import type { TriggerCampaignFormValues, TriggerMessage } from './trigger-campaign-schema';
import { replaceSpecialChars } from '@/features/campaigns/utils';
import { serializeSteps } from '@/features/segments/builder/builder-serializer';
import type { BuilderCard } from '@/features/segments/builder/types';

interface TriggerStepSettings {
  id: number;
  name: string;
  title: string;
  type: 'events' | 'custom_events';
  eventType?: string;
  applyFrequency: string;
  timePeriod: number;
  typeMultiply: string;
  conditional: unknown[];
  [key: string]: unknown;
}

interface StepNode {
  id: number;
  type: string;
  settings: Record<string, unknown>;
  child: StepNode[];
}

interface TriggerPayload {
  title: string;
  name: string;
  description: string;
  type: 'trigger';
  messageType: string;
  publisher: string;
  scheduleTo: string;
  status: number;
  steps: {
    id: 1;
    type: 'trigger';
    settings: TriggerStepSettings;
    child: StepNode[];
  };
}

function convertToMinutes(value: number, unit: 'days' | 'hours' | 'minutes'): number {
  if (unit === 'days') return value * 24 * 60;
  if (unit === 'hours') return value * 60;
  return value;
}

function formatMessage(msg: TriggerMessage): Record<string, unknown> {
  return {
    id: msg.id,
    title: msg.title,
    subject: msg.subject ?? '',
    name: msg.name ?? '',
    links: msg.links ?? [],
  };
}

export function buildTriggerPayload(form: TriggerCampaignFormValues, conditional?: unknown[]): TriggerPayload {
  let stepId = 3;

  // Build trigger settings (Step 2 - Who)
  const isCustomEvent = form.triggerType === 'custom_events';
  const triggerId = isCustomEvent ? (form.customEvent?.id ?? 0) : (form.triggerMessageId ?? form.messages[0]?.id ?? 0);
  const triggerName = isCustomEvent
    ? (form.customEvent?.name ?? '')
    : (form.triggerMessageTitle ?? form.messages[0]?.title ?? '');

  const settings = {
    id: triggerId,
    name: triggerName,
    title: triggerName,
    type: form.triggerType,
    ...(form.triggerType === 'events' && form.eventType ? { eventType: form.eventType } : {}),
    ...(isCustomEvent && form.customEvent ? { ...form.customEvent } : {}),
    applyFrequency: form.frequency,
    timePeriod:
      form.frequency === 'multiply-period'
        ? convertToMinutes(form.timePeriodValue ?? 1, form.timePeriodUnit ?? 'days')
        : 0,
    typeMultiply: form.frequency === 'multiply-period' ? (form.timePeriodUnit ?? '') : '',
    ...(conditional && conditional.length > 0 ? { conditional } : {}),
  } as TriggerStepSettings;

  // Build message steps (Step 1 - What)
  const messages = form.messages ?? [];
  let childSteps: StepNode[];

  if (messages.length > 1) {
    childSteps = [
      {
        id: stepId++,
        type: 'randomMessage',
        settings: {
          messages: messages.map(formatMessage),
        },
        child: [{ id: 2, type: 'end', settings: {}, child: [] }],
      },
    ];
  } else {
    const msg = messages[0];
    childSteps = [
      {
        id: stepId++,
        type: 'email',
        settings: msg ? formatMessage(msg) : {},
        child: [{ id: 2, type: 'end', settings: {}, child: [] }],
      },
    ];
  }

  // Wrap with wait step if needed (Step 3 - When)
  if (form.sendTiming === 'wait') {
    childSteps = [
      {
        id: stepId++,
        type: 'wait',
        settings: {
          timer: form.waitValue ?? 0,
          timerType: form.waitUnit ?? 'hours',
        },
        child: childSteps,
      },
    ];
  }

  // Build end-of-day scheduleTo
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  return {
    title: form.title,
    name: replaceSpecialChars(form.title),
    description: form.description ?? '',
    type: 'trigger',
    messageType: form.messageType,
    publisher: 'plusdin',
    scheduleTo: now.toISOString(),
    status: 1, // Scheduled
    steps: {
      id: 1,
      type: 'trigger',
      settings,
      child: childSteps,
    },
    // Fields expected by backend (matching Vue2 payload)
    campaignMessage: [],
    spreadSending: 60,
    confirmSaveDuplicate: false,
    sendToAll: false,
    runSegment: false,
    recurrenceCount: 0,
    sendAfterCreate: false,
    isRateLimit: true,
    testabScheduleTo: now.toISOString(),
    testabAudiencePercent: 10,
    testabCriteria: 'open',
    testabSentAfterTest: true,
    recurrenceSettings: {
      date: now.toISOString(),
      interval: 1,
      frequency: null,
      weekDays: [],
      hasExpiration: false,
      untilDate: null,
      untilSend: null,
      firstSentDate: null,
      lastSentDate: null,
    },
    labels: [],
    labelContent: [],
  } as TriggerPayload;
}

/**
 * Serialize the condition builder state for trigger campaigns.
 * Triggers expect a FLAT array of condition objects, not nested segments format.
 * Also sanitizes fields that the AJV schema rejects.
 */
export function serializeConditionalForTrigger(cards: BuilderCard[]): unknown[] {
  const serialized = serializeSteps(cards);
  return serialized
    .flat()
    .filter((item) => item.type !== 'conditionalCard')
    .map((item) => {
      if (item.type === 'interation') {
        // Remove fields not in AJV schema (additionalProperties: false)
        const { page_view_filter: _page_view_filter, page_view_value: _page_view_value, ...clean } = item as any;
        // Force message to 'any' — AJV only accepts this string value
        return { ...clean, message: 'any' };
      }
      return item;
    });
}
