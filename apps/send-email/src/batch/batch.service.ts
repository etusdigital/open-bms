import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../providers/redis/redis.service';
import { AutomationContactsBatch, Contact } from '../interfaces';
import { Batch } from '../mail/mail.interface';
import { MailService } from '../mail/mail.service';
import { MailUtils } from '../mail/mail.utils';
import { FormatterUtils } from '../utils/formatter.utils';
import { TrackerService } from '../tracker/tracker.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from '../event-publisher.service';
import { EmailProviderRouter } from '../handlers/email-provider.router';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class BatchService {
  constructor(
    private readonly mailService: MailService,
    private readonly mailUtils: MailUtils,
    private readonly formatterUtils: FormatterUtils,
    private readonly redisService: RedisService,
    private readonly trackerService: TrackerService,
    private readonly eventPublisher: EventPublisherService,
    private readonly emailProviderRouter: EmailProviderRouter,
  ) {}

  async campaignBatch(batch: Batch, debug: string) {
    if (!debug) {
      await this.sendTracker('EMAIL_BATCH', batch);
    }

    if ('is_campaign_warmup_mode' in batch) {
      batch.campaign_id = batch.campaign.campaignDefault.campaignId || batch.campaign.campaignDefault.id;
      batch.campaign.id = batch.campaign.campaignDefault.campaignId || batch.campaign.campaignDefault.id;
    }

    this.trackerService.logDebug(`Campaign Batch: ${batch.campaign_id} - ${batch.campaign_name}`);
    this.trackerService.logDebug(`Campaign: ${JSON.stringify(batch)}`);
    this.trackerService.logDebug(
      `Campaign Batch Emails: ${JSON.stringify(
        batch.contacts.map((contact) => {
          return {
            id: contact.id,
            email: contact.email,
          };
        }),
      )}`,
    );

    // TODO: REMOVE IT AFTER VALIDATE MICROSOFT SUBUSER
    if (batch.account.id === 1 && batch.message.ippool !== 'm02_brmailsrv_com' && batch.message.ippool !== 'microsoft_news_plusdin_com_br') {
      batch.contacts = this.removeMicrosoft(batch.contacts);
    }
    if (batch.campaign.isWarmup !== true) {
      batch.contacts = await this.cleanupContacts(batch.contacts, 'duplicated', batch.message.name);
    }
    batch.contacts = await this.cleanupContacts(batch.contacts, `${batch.account.id}:disengaged`, batch.message.name);
    batch.contacts = await this.cleanupContacts(batch.contacts, `${batch.account.id}:unsubscribed`, batch.message.name);
    batch.contacts = await this.cleanupContacts(batch.contacts, `${batch.account.id}:blocked`, batch.message.name);

    const timeZone = this.mailUtils.getAccountConfig(batch.account.accountConfigs, 'time_zone') || 'America/Sao_Paulo';
    const sendLimitPerUser = this.mailUtils.getAccountConfig(batch.account.accountConfigs, 'send_limit_per_user');
    if (sendLimitPerUser && batch.campaign.isRateLimit) {
      batch.contacts = await this.cleanupContactsQuantity(batch.contacts, parseInt(sendLimitPerUser), timeZone);
    }
    if (batch.contacts.length < 1) {
      await this.sendTracker('SENT_EMAIL_BATCH', batch, {});
      console.error(`[${batch.campaign_id}] Contacts array cannot be empty: ${JSON.stringify(batch)}`);
      return { status: false };
    }
    this.validateCampaign(batch);

    const provider = this.emailProviderRouter.resolveForMessage(batch.account, batch.message);
    const sendResponse = (await this.mailService.sendBatch(batch, provider, debug)) as any;

    if (sendResponse.results || sendResponse[0].statusCode === 202) {
      try {
        await this.saveBatchToRedis(batch, timeZone, sendLimitPerUser);
      } catch (error) {
        console.log(`[REDIS_ERROR] - ${JSON.stringify(error)}`);
      }
    }

    if (!debug && !batch.is_campaign_warmup_mode) {
      await this.sendTracker('SENT_EMAIL_BATCH', batch, sendResponse);
    }

    return sendResponse;
  }

  async automationBatch(batch: AutomationContactsBatch, debug: string) {
    this.trackerService.logDebug(`Received batch: ${batch.messageId}`);

    this.validateAutomationBatch(batch);
    const timeZone = this.mailUtils.getAccountConfig(batch.account.accountConfigs, 'time_zone') || 'America/Sao_Paulo';
    if (batch.account.id === 1 && batch.message.ippool !== 'm02_brmailsrv_com') {
      batch.contacts = this.removeMicrosoft(batch.contacts);
    }
    batch.contacts = await this.cleanupContacts(batch.contacts, 'duplicated', batch.message.name, batch.account.id);
    batch.contacts = await this.cleanupContacts(batch.contacts, `${batch.account.id}:disengaged`, batch.message.name);
    batch.contacts = await this.cleanupContacts(batch.contacts, `${batch.account.id}:unsubscribed`, batch.message.name);
    batch.contacts = await this.cleanupContacts(batch.contacts, `${batch.account.id}:blocked`, batch.message.name);
    if (batch.contacts.length < 1) {
      console.error(`[${batch.messageId}] Contacts array cannot be empty: ${JSON.stringify(batch)}`);
      return { status: false };
    }

    const provider = this.emailProviderRouter.resolveForMessage(batch.account, batch.message);
    const sendResponse = (await this.mailService.sendBatch(batch, provider, debug)) as any;

    if (sendResponse.results || sendResponse[0].statusCode === 202) {
      await this.saveBatchToRedis(batch, timeZone, 0);
    }

    return sendResponse;
  }

  validateCampaign(batch: Batch) {
    const limitContactBatch = parseInt(process.env.LIMIT_CONTACT_BATCH, 0);

    if (!batch || !batch.contacts || batch.contacts.length < 1) {
      console.error('Need contacts to send email', JSON.stringify(batch));
      throw new BadRequestException('Need contacts to send email');
    }

    if (batch.contacts.length > limitContactBatch) {
      console.error(`Limit of contacts per batch was exceeded. Sent ${batch.contacts.length} - Limit ${limitContactBatch}`, JSON.stringify(batch));
      throw new BadRequestException(`Limit of contacts per batch was exceeded. Sent ${batch.contacts.length} - Limit ${limitContactBatch}`);
    }

    if (!batch.message.subject || !batch.message.fromMail) {
      console.error('Check if the forwarded body has the necessary information to send an email', JSON.stringify(batch));
      throw new BadRequestException('Check if the forwarded body has the necessary information to send an email', JSON.stringify(batch.message));
    }

    if (!batch.message.content && (!batch.message.fileName || !batch.message.bucketName)) {
      console.error('Email must contain content or location object with fileName and bucketName', JSON.stringify(batch));
      throw new BadRequestException('Email must contain content or location object with fileName and bucketName', JSON.stringify(batch.message));
    }

    return batch;
  }

  validateAutomationBatch(batch: AutomationContactsBatch) {
    const limitContactBatch = parseInt(process.env.LIMIT_CONTACT_BATCH, 0);

    if (!batch || !batch.contacts) {
      console.error('Need contacts to send email', JSON.stringify(batch));
      throw new BadRequestException('Need contacts to send email');
    }

    if (batch.contacts.length > limitContactBatch) {
      console.error(`Limit of contacts per batch was exceeded. Sent ${batch.contacts.length} - Limit ${limitContactBatch}`, JSON.stringify(batch));
      throw new BadRequestException(`Limit of contacts per batch was exceeded. Sent ${batch.contacts.length} - Limit ${limitContactBatch}`);
    }

    if (!batch.message.subject || !batch.message.from.email) {
      console.error('Check if the forwarded body has the necessary information to send an email', JSON.stringify(batch));
      throw new BadRequestException('Check if the forwarded body has the necessary information to send an email', JSON.stringify(batch.message));
    }

    if (!batch.message.content && (!batch.message.location.fileName || !batch.message.location.bucketName)) {
      console.error('Email must contain location object with fileName and bucketName', JSON.stringify(batch));
      throw new BadRequestException('Email must contain location object with fileName and bucketName', JSON.stringify(batch.message));
    }

    return batch;
  }

  async sendTracker(event: string, batch: Batch, data?: any) {
    const tracker = {
      campaign_id: batch.campaign_id,
      service: 'MSGOPS_SEND_BATCH_EMAIL',
      event: event,
      timestamp: new Date().getTime(),
      audiences: [],
      contacts_length: batch.contacts.length,
      packages_length: null,
      package_id: null,
      email_id: batch.message.id,
      email_subject: batch.message.subject,
      cloud_run: process.env.CLOUD_RUN,
      PORT: process.env.PORT,
      k_revision: process.env.K_REVISION,
      k_configuration: process.env.K_CONFIGURATION,
      page: batch.page,
      totalPages: batch.totalPages,
      data: data,
      testabMode: batch.campaign_test_ab_mode,
    };

    return this.eventPublisher.publish(EXCHANGES.campaigns, 'campaign.tracked', tracker);
  }

  async cleanupContacts(contacts: Contact[], category = 'duplicated', emailTitle?: string, accountId?: number): Promise<Contact[]> {
    if (contacts.length === 0) {
      return contacts;
    }
    const redisClient = this.redisService.getOrThrow();
    const emailName = this.formatterUtils.slugify(emailTitle);
    const emails = contacts.map((contact) => {
      if (category === 'duplicated') {
        return `${accountId}:${contact.email}:${emailName}`;
      }
      return `${category}:${contact.email}`;
    });
    const emailsInRedis = await redisClient.mget(emails);

    return contacts.filter((contact, index) => {
      const alreadySent = emailsInRedis[index];
      if (alreadySent) {
        this.trackerService.logDebug(`${category.toUpperCase()}:  - ${contact.email} - ${emailName}`);
      }

      return alreadySent !== 'true';
    });
  }

  async cleanupContactsQuantity(contacts: Contact[], sendLimitPerUser: number, timezone: string): Promise<Contact[]> {
    if (contacts.length === 0) {
      return contacts;
    }
    const redisClient = this.redisService.getOrThrow();
    const currentDate = dayjs().tz(timezone).format('YYYY-MM-DD');
    const keys = contacts.map((contact) => {
      return `contact_send:${contact.id}:${currentDate}`;
    });
    const contactsInRedis = await redisClient.mget(keys);

    return contacts.filter((contact, index) => {
      const alreadySent = contactsInRedis[index];
      if (alreadySent && parseInt(alreadySent) >= sendLimitPerUser) {
        console.log(`Contact limit reached:  - ${contact.email}`);
        return false;
      }
      return true;
    });
  }

  removeMicrosoft(contacts: Contact[]): Contact[] {
    return contacts.filter((contact) => {
      const isMicrosoft = this.mailUtils.isMicrosoft(contact.email);
      if (isMicrosoft) {
        this.trackerService.logDebug(`Remove microsoft email: ${contact.email}`);
      }
      return isMicrosoft === false;
    });
  }

  async saveBatchToRedis(batch: Batch | AutomationContactsBatch, timezone: string, sendLimitPerUser) {
    const redisClient = this.redisService.getOrThrow();
    const emailName = this.formatterUtils.slugify(batch.message.name);
    const currentDate = dayjs().tz(timezone).format('YYYY-MM-DD');
    const now = dayjs().tz(timezone);
    const nextDay = now.add(1, 'day').startOf('day');
    const secondsToNextDay = nextDay.diff(now, 'second');

    const contacts = batch.contacts;
    contacts.map(async (contact) => {
      try {
        await redisClient.set(`${batch.account.id}:${contact.email}:${emailName}`, 'true', 'EX', 60 * 60 * 2);
        if (sendLimitPerUser) {
          const key = `contact_send:${contact.id}:${currentDate}`;
          if (!(await redisClient.exists(key))) {
            await redisClient.set(key, 0, 'EX', secondsToNextDay);
          }
          await redisClient.incr(key);
        }
      } catch (error) {
        this.trackerService.logError(`Unable to save in Redis. ${error}`);
      }
    });

    /**
     * FEAT: Rate limit by pool
     * Register emails sent by pool on Redis
     * Keys auto expires in 2h and 24h
     */
    const ipPool = batch.message.ippool;
    const currentHour = dayjs().tz('America/Sao_Paulo').hour();

    const hourlySentKey = `pool_${ipPool}:sent-by-hour-${currentHour}`;
    await redisClient.incrby(hourlySentKey, batch.contacts.length, (error, currentTotal) => {
      if (error) {
        this.trackerService.logError(`Unable to increment in Redis. ${error}`);
      }

      if (currentTotal === 1) {
        redisClient.expire(hourlySentKey, 7200);
      }
    });

    const dailySentKey = `pool_${ipPool}:sent-by-day-${currentDate}`;
    await redisClient.incrby(dailySentKey, batch.contacts.length, (error, currentTotal) => {
      if (error) {
        this.trackerService.logError(`Unable to increment in Redis. ${error}`);
      }

      if (currentTotal === 1) {
        redisClient.expire(dailySentKey, 86400);
      }
    });
  }

  async getRedis(redisKey) {
    const redisClient = this.redisService.getOrThrow();
    const payload = await redisClient.getdel(redisKey);
    return JSON.parse(payload);
  }

  async setRedis(redisKey, payload) {
    const redisClient = this.redisService.getOrThrow();
    return await redisClient.set(redisKey, JSON.stringify(payload), 'EX', 43200);
  }

  async publishCampaignError(payload) {
    return await this.eventPublisher.publish(EXCHANGES.email, 'email.error', payload);
  }
}
