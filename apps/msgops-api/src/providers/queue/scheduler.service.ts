import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import {
  QUEUE_BMS_USAGE,
  QUEUE_CAMPAIGN_TESTAB,
  QUEUE_CAMPAIGN_TRIGGER,
  QUEUE_SEGMENT,
  QUEUE_WHATSAPP_MESSAGE,
  SCHEDULER_JOB_OPTS,
  SchedulerJobPayload,
  SchedulerQueueName,
  resolveQueueName,
} from './queue.constants';

/**
 * Drop-in replacement for the legacy GoogleTasksProvider API, backed by BullMQ
 * delayed jobs. The original `queue` argument (a Cloud Tasks queue name from
 * env) is mapped onto one of five dedicated BullMQ queues so that slow jobs
 * in one logical type don't head-of-line-block another.
 *
 * The job id format `${queue}:${idSegment}:${rand}` is preserved so existing
 * DB columns (scheduleCloudTaskId, testabScheduleToCloudTaskId, etc.) keep
 * working without a migration.
 */
@Injectable()
export class SchedulerService {
  private readonly queues: Record<SchedulerQueueName, Queue>;

  constructor(
    @InjectQueue(QUEUE_CAMPAIGN_TRIGGER) private readonly campaignTriggerQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_TESTAB) private readonly campaignTestabQueue: Queue,
    @InjectQueue(QUEUE_SEGMENT) private readonly segmentQueue: Queue,
    @InjectQueue(QUEUE_BMS_USAGE) private readonly bmsUsageQueue: Queue,
    @InjectQueue(QUEUE_WHATSAPP_MESSAGE) private readonly whatsappMessageQueue: Queue,
  ) {
    this.queues = {
      [QUEUE_CAMPAIGN_TRIGGER]: this.campaignTriggerQueue,
      [QUEUE_CAMPAIGN_TESTAB]: this.campaignTestabQueue,
      [QUEUE_SEGMENT]: this.segmentQueue,
      [QUEUE_BMS_USAGE]: this.bmsUsageQueue,
      [QUEUE_WHATSAPP_MESSAGE]: this.whatsappMessageQueue,
    };
  }

  async create(id: number | string, scheduleTo: Date, baseUrl: string, queue: string, body?: string): Promise<[{ name: string }]> {
    // Empty-string ids come from the legacy automations testab path. Falling
    // back to a random anon-* keeps job ids unique and human-readable.
    const idSegment = id === '' || id == null ? `anon-${crypto.randomBytes(4).toString('hex')}` : String(id);
    const jobName = `${queue}:${idSegment}:${crypto.randomBytes(6).toString('hex')}`;
    const delayMs = Math.max(0, new Date(scheduleTo).getTime() - Date.now());

    const payload: SchedulerJobPayload = {
      url: `${baseUrl}/${id}`,
      body,
      taskQueue: queue,
    };

    const targetQueue = this.queues[resolveQueueName(queue)];
    await targetQueue.add(jobName, payload, {
      ...SCHEDULER_JOB_OPTS,
      jobId: jobName,
      delay: delayMs,
    });

    return [{ name: jobName }];
  }

  // delete() mirrors the legacy GoogleTasksProvider contract loosely: callers
  // historically wrapped delete in try/catch and ignored NOT_FOUND, so it's
  // safe to silently return false when the job is already gone. We probe all
  // five queues because the queue arg may have changed since the job was
  // scheduled (e.g. env var rename).
  async delete(name: string, queue: string): Promise<boolean> {
    const targetQueue = this.queues[resolveQueueName(queue)];
    const job = (await targetQueue.getJob(name)) ?? (await this.findJobAcrossQueues(name));
    if (!job) return false;
    await job.remove();
    return true;
  }

  // callRunTask MUST throw SchedulerJobNotFoundError when the job is missing.
  // The legacy `client.runTask` threw gRPC NOT_FOUND in that case, and at
  // least one caller (automations.service.ts#stopTestAb) depends on the throw
  // as control-flow to fall back to finishTestabStep. Returning false would
  // silently strand the test A/B step.
  async callRunTask(name: string, queue: string): Promise<true> {
    const targetQueue = this.queues[resolveQueueName(queue)];
    const job = (await targetQueue.getJob(name)) ?? (await this.findJobAcrossQueues(name));
    if (!job) throw new SchedulerJobNotFoundError(name);
    await job.promote();
    return true;
  }

  private async findJobAcrossQueues(name: string) {
    for (const q of Object.values(this.queues)) {
      const job = await q.getJob(name);
      if (job) return job;
    }
    return null;
  }
}

export class SchedulerJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Scheduler job not found: ${jobId}`);
    this.name = 'SchedulerJobNotFoundError';
  }
}
