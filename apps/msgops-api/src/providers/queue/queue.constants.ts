// Five logical scheduler queues, mirroring the legacy Cloud Tasks topology.
// Each is backed by an isolated BullMQ queue + worker so a slow job in one
// type cannot head-of-line-block another (e.g. a stuck whatsapp monitor must
// not stall campaign-trigger dispatch).
export const QUEUE_CAMPAIGN_TRIGGER = 'bms-scheduler-campaign-trigger';
export const QUEUE_CAMPAIGN_TESTAB = 'bms-scheduler-campaign-testab';
export const QUEUE_SEGMENT = 'bms-scheduler-segment';
export const QUEUE_BMS_USAGE = 'bms-scheduler-bms-usage';
export const QUEUE_WHATSAPP_MESSAGE = 'bms-scheduler-whatsapp-message';

export const SCHEDULER_QUEUE_NAMES = [QUEUE_CAMPAIGN_TRIGGER, QUEUE_CAMPAIGN_TESTAB, QUEUE_SEGMENT, QUEUE_BMS_USAGE, QUEUE_WHATSAPP_MESSAGE] as const;

export type SchedulerQueueName = (typeof SCHEDULER_QUEUE_NAMES)[number];

export const SCHEDULER_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
};

// Enterprise → OSS import 1:1 com o worker app `apps/enterprise-import`.
// Sem prefixo `bms-` por convenção do spec — alinhado ao nome do app.
export const QUEUE_ENTERPRISE_IMPORT = 'enterprise-import';

export const JOB_OPTS_ENTERPRISE_IMPORT = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
};

export interface SchedulerJobPayload {
  url: string;
  body?: string;
  taskQueue: string;
}

// Maps a queue name string to a known SchedulerQueueName constant.
// Falls back to QUEUE_CAMPAIGN_TRIGGER for unknown values so misconfigured
// call sites don't drop jobs silently.
export function resolveQueueName(taskQueue: string | undefined): SchedulerQueueName {
  if (SCHEDULER_QUEUE_NAMES.includes(taskQueue as SchedulerQueueName)) {
    return taskQueue as SchedulerQueueName;
  }
  return QUEUE_CAMPAIGN_TRIGGER;
}
