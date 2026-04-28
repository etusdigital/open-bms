import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

export const QUEUE_ANALYTICS = 'analytics-events';
export const QUEUE_SEGMENT_ANALYTICS = 'segment-analytics';
export const QUEUE_CONTACTS_BATCH = 'contacts-batch';
export const QUEUE_SEGMENT_PROCESS = 'segment-process';
export const QUEUE_TAG_PROCESS = 'tag-process';

@Injectable()
export class QueuePublisher {
  private readonly logger = new Logger(QueuePublisher.name);

  constructor(
    @InjectQueue(QUEUE_ANALYTICS) private readonly analyticsQueue: Queue,
    @InjectQueue(QUEUE_SEGMENT_ANALYTICS) private readonly segmentAnalyticsQueue: Queue,
    @InjectQueue(QUEUE_CONTACTS_BATCH) private readonly contactsBatchQueue: Queue,
    @InjectQueue(QUEUE_SEGMENT_PROCESS) private readonly segmentProcessQueue: Queue,
  ) {}

  async publishAnalyticsEvent(event: any): Promise<void> {
    await this.analyticsQueue.add(
      'track',
      { payload: [event], platform: 'internal' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    );
  }

  async publishSegmentData(data: any): Promise<void> {
    await this.segmentAnalyticsQueue.add('track', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }

  async publishContactsBatch(payload: any): Promise<void> {
    await this.contactsBatchQueue.add('process', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }

  async scheduleSegmentRecalculation(segmentId: number, delayMs: number): Promise<Job> {
    const jobId = `segment-${segmentId}-${Date.now()}`;
    return this.segmentProcessQueue.add(
      'recalculate',
      { segmentId },
      {
        delay: Math.max(0, delayMs),
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
  }

  async cancelSegmentJob(jobId: string): Promise<void> {
    try {
      const job = await this.segmentProcessQueue.getJob(jobId);
      if (job) await job.remove();
    } catch (err) {
      this.logger.warn(`Failed to cancel segment job ${jobId}: ${err?.message}`);
    }
  }
}
