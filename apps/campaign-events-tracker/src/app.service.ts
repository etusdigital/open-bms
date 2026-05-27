import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { EventTracker, MsgopsCampaignEvent, MsgopsServices, StatusCampaignEnum } from './app.interfaces';
import { MsgopsService } from './msgops/msgops.service';
import { RedisService } from './providers/redis/redis.service';

@Injectable()
export class AppService {
  constructor(
    private readonly msgOpsService: MsgopsService,
    private readonly redisService: RedisService,
  ) {}

  async addEventTracker(eventTracker: EventTracker, debug: string) {
    const isInvalid = this.validate(eventTracker);
    if (debug || isInvalid) {
      return eventTracker;
    }
    try {
      this.logInfo(`Received message: ${JSON.stringify(eventTracker)}`);
      return await this.updateStatus(eventTracker);
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException(
        err.message || `Error to save event tracker. data: ${JSON.stringify(eventTracker)}`,
      );
    }
  }

  validate(eventTracker: EventTracker) {
    if (!(eventTracker.event in MsgopsCampaignEvent)) {
      this.logInfo(`Event needs to be defined: ${JSON.stringify(eventTracker)}`);
      return true;
    }

    if (!eventTracker.timestamp) {
      throw new BadRequestException(`Could not find "timestamp" property.`);
    }

    if (!eventTracker.campaign_id) {
      throw new BadRequestException(`Could not find "campaign_id" property.`);
    }

    if (!eventTracker.service) {
      throw new BadRequestException(`Could not find "service" property.`);
    }

    if (!(eventTracker.service in MsgopsServices)) {
      throw new BadRequestException(`Service needs to be defined. ex: ${Object.keys(MsgopsServices)}`);
    }

    if (!eventTracker.event) {
      throw new BadRequestException(`Could not find "event" property.`);
    }

    return false;
  }

  formatEventTracker(eventTracker: EventTracker) {
    const formattedEventTracker = {
      ...eventTracker,
      data: eventTracker ? JSON.stringify(eventTracker.data) : ``,
    };
    return formattedEventTracker;
  }

  async updateStatus(eventTracker: EventTracker) {
    const redisClient = this.redisService.getClient();
    const { page } = eventTracker;
    let campaign = {};
    switch (eventTracker.event) {
      case MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED:
        campaign = {
          status: eventTracker.testabMode ? StatusCampaignEnum.SENDING_TEST_AB : StatusCampaignEnum.SENDING,
        };
        break;
      case MsgopsCampaignEvent.SENT_EMAIL_BATCH:
      case MsgopsCampaignEvent.SENT_PUSH_BATCH:
      case MsgopsCampaignEvent.SENT_SMS_BATCH:
      case MsgopsCampaignEvent.SENT_WHATSAPP_BATCH:
        const sentPercentage: number = parseFloat(((page / eventTracker.totalPages) * 100).toFixed(1));
        const sentContacts: number = eventTracker.contacts_length;

        const redisExpiration = 60 * 60 * 12;
        await redisClient.incrby(`sentContacts:campaign:${eventTracker.campaign_id}`, sentContacts);
        await redisClient.expire(`sentContacts:campaign:${eventTracker.campaign_id}`, redisExpiration);
        await redisClient.set(
          `sentPercentage:campaign:${eventTracker.campaign_id}`,
          sentPercentage,
          'EX',
          redisExpiration,
        );

        if (page == eventTracker.totalPages) {
          if (!eventTracker.testabMode) {
            const totalSent = await redisClient.get(`sentContacts:campaign:${eventTracker.campaign_id}`);
            campaign = {
              status: StatusCampaignEnum.COMPLETED,
              sentContacts: Number(totalSent),
              sentPercentage,
            };
          }
        }

        break;
    }

    if (Object.keys(campaign).length) {
      await this.msgOpsService.updateStatus(eventTracker.campaign_id, campaign);
    }
  }

  logInfo(dsc: string, args?: string) {
    const logLevel = process.env.LOG_LEVEL || 'INFO';
    if (logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }
}
