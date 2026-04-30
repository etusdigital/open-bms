import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Campaign, CampaignBatch } from '../../interfaces';

export const QUEUE_CAMPAIGN_PACKER = 'campaign-packer';
export const QUEUE_CAMPAIGN_PACKER_WARMUP = 'campaign-packer-warmup';
export const QUEUE_CAMPAIGN_SCHEDULE_PAGE = 'campaign-schedule-page';
export const QUEUE_CAMPAIGN_TRIGGER = 'campaign-trigger';
export const QUEUE_CAMPAIGN_SEND_MESSAGE = 'campaign-send-message';
export const QUEUE_CAMPAIGN_EVENTS_TRACKER = 'campaign-events-tracker';
export const QUEUE_WARMUP_TRACKER = 'warmup-tracker';

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
    @InjectQueue(QUEUE_CAMPAIGN_PACKER_WARMUP) private readonly warmupQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_SCHEDULE_PAGE) private readonly schedulePageQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_TRIGGER) private readonly triggerQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_SEND_MESSAGE) private readonly sendMessageQueue: Queue,
    @InjectQueue(QUEUE_CAMPAIGN_EVENTS_TRACKER) private readonly eventsTrackerQueue: Queue,
    @InjectQueue(QUEUE_WARMUP_TRACKER) private readonly warmupTrackerQueue: Queue,
  ) {}

  async addCampaignPacker(campaign: Campaign | object): Promise<string | undefined> {
    const job = await this.packerQueue.add('process-campaign', campaign, JOB_OPTS);
    return job.id;
  }

  async addCampaignPackerWarmup(data: { warmups: number[]; campaign: Campaign | object }): Promise<string | undefined> {
    const job = await this.warmupQueue.add('warmup-start', data, JOB_OPTS);
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

  async addSendMessage(data: object): Promise<string | undefined> {
    const job = await this.sendMessageQueue.add('send', data, JOB_OPTS);
    return job.id;
  }

  async addEventsTracker(data: object): Promise<string | undefined> {
    const job = await this.eventsTrackerQueue.add('track', data, JOB_OPTS);
    return job.id;
  }

  async addWarmupTracker(data: object): Promise<string | undefined> {
    const job = await this.warmupTrackerQueue.add('track', data, JOB_OPTS);
    return job.id;
  }
}
