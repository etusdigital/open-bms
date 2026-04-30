import { Injectable } from '@nestjs/common';
import { CampaignEntity } from './entities/campaign.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CampaignRecurrenceFrequency, CampaignsType, StatusCampaignEnum } from '../app.interfaces';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import dayjs from 'dayjs';

@Injectable()
export class MsgopsService {
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
      newEventDate = this.nextOccurrence(campaign.scheduleTo, recurrenceSettings.weekDays, recurrenceSettings.interval);
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

  nextOccurrence(currentScheduleTo: Date, weekDays: number[], interval: number): Date {
    weekDays.sort();

    let findDate = dayjs(currentScheduleTo)
      .set('hour', currentScheduleTo.getHours())
      .set('minutes', currentScheduleTo.getMinutes())
      .set('seconds', 0)
      .set('milliseconds', 0)
      .add(1, 'day');

    const latestSentDate = dayjs(currentScheduleTo)
      .startOf('week')
      .set('hour', currentScheduleTo.getHours())
      .set('minutes', currentScheduleTo.getMinutes());

    while (true) {
      if (weekDays.includes(findDate.day()) && findDate.toDate() >= dayjs().toDate()) {
        const isValidWeek = findDate
          .startOf('week')
          .set('hour', currentScheduleTo.getHours())
          .set('minutes', currentScheduleTo.getMinutes())
          .diff(latestSentDate, 'week');

        if (isValidWeek % interval === 0) {
          return findDate.toDate();
        } else {
          // Not the correct week based on interval. Skip to the next week's same day.
          findDate = findDate
            .add(7, 'day')
            .startOf('week')
            .set('hour', currentScheduleTo.getHours())
            .set('minutes', currentScheduleTo.getMinutes());
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
