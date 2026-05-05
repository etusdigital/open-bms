import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Campaign, CampaignBatch } from '../../interfaces';

export const QUEUE_CAMPAIGN_PACKER = 'campaign-packer';
export const QUEUE_CAMPAIGN_SCHEDULE_PAGE = 'campaign-schedule-page';
export const QUEUE_CAMPAIGN_TRIGGER = 'campaign-trigger';

const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
};

@Injectable()
export class QueuePublisher {
  constructor(
    @InjectQueue(QUEUE_CAMPAIGN_PACKER) private readonly packerQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_SCHEDULE_PAGE) private readonly schedulePageQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_TRIGGER) private readonly triggerQueue: Queue,
  ) {}

  async addCampaignPacker(campaign: Campaign | object): Promise<string | undefined> {
    const job = await this.packerQueue.add('process-campaign', campaign, JOB_OPTS);
    return job.id;
  }

  async addSchedulePage(data: CampaignBatch, delayMs: number): Promise<string | undefined> {
    const job = await this.schedulePageQueue.add('process-page', data, { ...JOB_OPTS, delay: Math.max(0, delayMs) });
    return job.id;
  }

  async addCampaignTrigger(campaignId: number, delayMs: number): Promise<string | undefined> {
    const job = await this.triggerQueue.add('create-contacts-send', { campaignId }, { ...JOB_OPTS, delay: Math.max(0, delayMs) });
    return job.id;
  }
}
