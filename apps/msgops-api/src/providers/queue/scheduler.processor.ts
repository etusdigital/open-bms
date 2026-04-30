import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_BMS_USAGE, QUEUE_CAMPAIGN_TESTAB, QUEUE_CAMPAIGN_TRIGGER, QUEUE_SEGMENT, QUEUE_WHATSAPP_MESSAGE, SchedulerJobPayload } from './queue.constants';

// 30 min, matching the legacy CloudTasks `dispatchDeadline: 1800s` from the
// previous GoogleTasksProvider. Prevents a hung loopback POST from pinning a
// worker slot indefinitely.
const DISPATCH_TIMEOUT_MS = 1_800_000;

// Per-queue concurrency. Each queue runs its own worker, so a slow job in one
// queue cannot starve another (the v1 single-queue design caused head-of-line
// blocking risk — see CR notes on EVO-959).
const PER_QUEUE_CONCURRENCY = 5;

abstract class BaseSchedulerProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  async process(job: Job<SchedulerJobPayload>): Promise<unknown> {
    const { url, body, taskQueue } = job.data;
    const headers: Record<string, string> = {};

    if (process.env.CRON_SECRET) {
      headers['X-Cron-Secret'] = process.env.CRON_SECRET;
    }
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    // Job id is included in headers so downstream handlers can de-duplicate
    // retried dispatches (X-Idempotency-Key). Handlers that mutate state
    // MUST treat repeated calls with the same key as a no-op.
    if (job.id) {
      headers['X-Idempotency-Key'] = String(job.id);
    }

    this.logger.log(`Dispatching scheduler job ${job.id} (${taskQueue}) → POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Scheduler HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return { status: response.status, taskQueue };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Scheduler job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`);
  }
}

@Processor(QUEUE_CAMPAIGN_TRIGGER, { concurrency: PER_QUEUE_CONCURRENCY })
export class CampaignTriggerProcessor extends BaseSchedulerProcessor {}

@Processor(QUEUE_CAMPAIGN_TESTAB, { concurrency: PER_QUEUE_CONCURRENCY })
export class CampaignTestabProcessor extends BaseSchedulerProcessor {}

@Processor(QUEUE_SEGMENT, { concurrency: PER_QUEUE_CONCURRENCY })
export class SegmentProcessor extends BaseSchedulerProcessor {}

@Processor(QUEUE_BMS_USAGE, { concurrency: PER_QUEUE_CONCURRENCY })
export class BmsUsageProcessor extends BaseSchedulerProcessor {}

@Processor(QUEUE_WHATSAPP_MESSAGE, { concurrency: PER_QUEUE_CONCURRENCY })
export class WhatsappMessageProcessor extends BaseSchedulerProcessor {}
