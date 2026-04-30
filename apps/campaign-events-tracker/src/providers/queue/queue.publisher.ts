import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const QUEUE_CAMPAIGN_EVENTS_TRACKER = 'campaign-events-tracker';
export const QUEUE_CAMPAIGN_TRIGGER = 'campaign-trigger';

const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
};

@Injectable()
export class QueuePublisher {
  constructor(@InjectQueue(QUEUE_CAMPAIGN_TRIGGER) private readonly triggerQueue: Queue) {}

  async addCampaignTrigger(campaignId: number, delayMs: number): Promise<string | undefined> {
    const job = await this.triggerQueue.add(
      'create-contacts-send',
      { campaignId },
      { ...JOB_OPTS, delay: Math.max(0, delayMs) },
    );
    return job.id;
  }
}
