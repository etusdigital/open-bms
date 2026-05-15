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

// Maps the legacy GOOGLE_TASK_* env-var values (still passed by call sites
// for backward compatibility) onto the new BullMQ queue names. Anything not
// in the map falls back to QUEUE_CAMPAIGN_TRIGGER so misconfigured env vars
// don't drop jobs silently.
export function resolveQueueName(taskQueue: string | undefined): SchedulerQueueName {
  if (!taskQueue) return QUEUE_CAMPAIGN_TRIGGER;
  if (taskQueue === process.env.GOOGLE_TASK_QUEUE_TEST_AB) return QUEUE_CAMPAIGN_TESTAB;
  if (taskQueue === process.env.GOOGLE_TASK_SEGMENT) return QUEUE_SEGMENT;
  if (taskQueue === process.env.GOOGLE_TASK_BMS_USAGE) return QUEUE_BMS_USAGE;
  if (taskQueue === process.env.GOOGLE_TASK_WHATSAPP_MESSAGE) return QUEUE_WHATSAPP_MESSAGE;
  return QUEUE_CAMPAIGN_TRIGGER;
}
