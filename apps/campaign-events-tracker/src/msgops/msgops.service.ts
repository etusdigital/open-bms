import { Injectable, Logger } from '@nestjs/common';
import { CampaignEntity } from './entities/campaign.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CampaignRecurrenceFrequency, CampaignsType, StatusCampaignEnum } from '../app.interfaces';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Validates an `accounts_configs.time_zone` value and falls back to `'UTC'`
 * when it is not a recognised IANA zone. Non-IANA strings (e.g. `"BRT"`,
 * `"GMT-3"`, typos, deprecated zones) make `dayjs(...).tz(value)` silently
 * return Invalid Date, which then propagates through `nextOccurrence` and
 * breaks rescheduling without a clear error.
 */
export function resolveIanaTimezone(value: string | undefined | null, logger?: Logger): string {
  if (!value) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    logger?.warn(`Invalid IANA timezone "${value}" in accounts_configs; falling back to UTC`);
    return 'UTC';
  }
}

@Injectable()
export class MsgopsService {
  private readonly logger = new Logger(MsgopsService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(CampaignContactEntity)
    private readonly campaignContactRepository: Repository<CampaignContactEntity>,
    private readonly queuePublisher: QueuePublisher,
  ) {}

  async updateStatus(campaignId: number, campaignDto) {
    let campaign = await this.campaignRepository.findOneOrFail({
      where: { id: campaignId },
    });
    if (campaign.status !== StatusCampaignEnum.COMPLETED) {
      this.campaignRepository.merge(campaign, campaignDto);
    }

    if (campaign.status === StatusCampaignEnum.COMPLETED) {
      await this.clearCampaignsContacts(campaignId);

      if (campaign.type === CampaignsType.RECURRING) {
        campaign = await this.setRecurringCampaign(campaign);
      }
    }

    await this.campaignRepository.update(campaign.id, campaign);
  }

  async clearCampaignsContacts(campaignId: number) {
    await this.campaignContactRepository
      .createQueryBuilder('campaigns_contacts')
      .delete()
      .from(CampaignContactEntity)
      .where('campaign_id = :campaignId', { campaignId })
      .execute();
  }

  async setRecurringCampaign(campaign: CampaignEntity) {
    const { recurrenceSettings } = campaign;

    campaign.recurrenceCount++;

    campaign.recurrenceSettings = {
      ...campaign.recurrenceSettings,
      lastSentDate: new Date(campaign.scheduleTo),
    };

    if (campaign.recurrenceCount === 1) {
      campaign.recurrenceSettings = {
        ...campaign.recurrenceSettings,
        firstSentDate: campaign.recurrenceSettings.date,
      };
    }

    if (recurrenceSettings.untilSend !== null && campaign.recurrenceCount === recurrenceSettings.untilSend) {
      return campaign;
    }

    let newEventDate = campaign.scheduleTo;
    if (recurrenceSettings.frequency === CampaignRecurrenceFrequency.daily) {
      newEventDate.setDate(newEventDate.getDate() + recurrenceSettings.interval);
    }

    if (recurrenceSettings.frequency === CampaignRecurrenceFrequency.weekly) {
      const accountTimezone = await this.getAccountTimezone(campaign.id);
      newEventDate = this.nextOccurrence(
        campaign.scheduleTo,
        recurrenceSettings.weekDays,
        recurrenceSettings.interval,
        accountTimezone,
      );
    }

    if (recurrenceSettings.frequency === CampaignRecurrenceFrequency.monthly) {
      newEventDate.setMonth(newEventDate.getMonth() + recurrenceSettings.interval);
    }

    if (recurrenceSettings.untilDate === null || this.isNextDateValid(newEventDate, recurrenceSettings.untilDate)) {
      campaign.scheduleTo = newEventDate;
      campaign.status = StatusCampaignEnum.SCHEDULED;

      const diffMs = new Date(campaign.scheduleTo).getTime() - Date.now();
      const jobId = await this.queuePublisher.addCampaignTrigger(campaign.id, diffMs);
      campaign.scheduleToCloudTaskId = jobId || '';
    } else {
      campaign.scheduleTo = recurrenceSettings.lastSentDate;
      campaign.status = StatusCampaignEnum.COMPLETED;
    }

    return campaign;
  }

  /**
   * Loads the IANA timezone configured for the campaign's owner account.
   * Uses raw SQL because the tracker does not map an Account entity.
   * Falls back to 'UTC' when no config exists.
   */
  async getAccountTimezone(campaignId: number): Promise<string> {
    const rows: Array<{ value: string }> = await this.campaignRepository.manager.query(
      `SELECT ac.value
         FROM campaigns c
         JOIN accounts_configs ac ON ac.account_id = c.account_id
        WHERE c.id = $1
          AND ac.name = 'time_zone'
        ORDER BY ac.id DESC
        LIMIT 1`,
      [campaignId],
    );
    return resolveIanaTimezone(rows[0]?.value, this.logger);
  }

  nextOccurrence(currentScheduleTo: Date, weekDays: number[], interval: number, tz: string): Date {
    weekDays.sort();

    // All day/week arithmetic happens in the account's timezone — prevents
    // PDBR-144, where calculations ran in UTC and shifted the next occurrence
    // by 1 day for any time that crosses midnight UTC. After `.tz(tz)`, the
    // dayjs instance already carries the local hour/minute, so we only need
    // to re-pin hour/minute when re-anchoring to startOf('week').
    const ref = dayjs(currentScheduleTo).tz(tz);
    const localHour = ref.hour();
    const localMinute = ref.minute();

    let findDate = ref.set('second', 0).set('millisecond', 0).add(1, 'day');

    const latestSentDate = ref.startOf('week').set('hour', localHour).set('minute', localMinute);

    while (true) {
      if (weekDays.includes(findDate.day()) && findDate.toDate() >= dayjs().toDate()) {
        const isValidWeek = findDate
          .startOf('week')
          .set('hour', localHour)
          .set('minute', localMinute)
          .diff(latestSentDate, 'week');

        if (isValidWeek % interval === 0) {
          return findDate.toDate();
        } else {
          // Not the correct week based on interval. Skip to the next week's same day.
          findDate = findDate.add(7, 'day').startOf('week').set('hour', localHour).set('minute', localMinute);
          continue;
        }
      }

      // Move to the next day in the list of weekDays.
      const currentDayIndex = weekDays.findIndex((d) => d > findDate.day());
      if (currentDayIndex !== -1) {
        findDate = findDate.add(weekDays[currentDayIndex] - findDate.day(), 'day');
      } else {
        findDate = findDate.add(7 - findDate.day() + weekDays[0], 'day');
      }
    }
  }

  isNextDateValid(scheduleTo: Date, sendUntilDate: Date): boolean {
    return scheduleTo.getTime() <= sendUntilDate.getTime();
  }
}
