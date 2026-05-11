import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { EXCHANGES } from '@bms/messaging';
import { Campaign, CampaignBatch, CampaignMessageType, CampaignStatus, CampaignType } from '../interfaces';
import { MsgopsService } from '../msgops/msgops.service';
import { ContactEntity } from '../msgops/entities/contact.entity';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { RedisService } from '../providers/redis/redis.service';
import { EventPublisherService } from '../providers/messaging/event-publisher.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { FormatterUtils } from 'src/utils/formatter.utils';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class CampaignService {
  private packagesLength: number;
  private contactsLength: number;
  constructor(
    private readonly msgopsService: MsgopsService,
    private readonly queuePublisher: QueuePublisher,
    private readonly redisService: RedisService,
    private readonly formatterUtils: FormatterUtils,
    private readonly eventPublisher: EventPublisherService,
  ) {
    this.packagesLength = 0;
    this.contactsLength = 0;
  }

  async createContactsSend(id: number) {
    this.formatterUtils.logInfo(`Campaign processed: ${id}.`);
    const redisClient = this.redisService.getOrThrow();
    const stopCampaign = await redisClient.get(`stop_campaign_${id}`);
    if (stopCampaign) {
      this.formatterUtils.logInfo(`[Process Campaign] Stop processing campaign: ${id}`);
      return;
    }

    const campaign = await this.msgopsService.getCampaign(id);

    if (!campaign || !campaign.campaignMessage.length || campaign.deletedAt) {
      return `Id ${id} campaign was not found and cannot be run.`;
    }

    if (campaign.type === CampaignType.SIMPLE || campaign.type === CampaignType.RECURRING) {
      await this.msgopsService.createContactsSend(campaign);
    }

    await this.sendTracker(0, 0, campaign.id, 'CAMPAIGN_PROCESSING_STARTED');

    return this.queuePublisher.addCampaignPacker(campaign);
  }

  getTagsInCampaign(steps) {
    const tagsIds = [];
    for (const currentSteps of steps) {
      for (const card of currentSteps) {
        if (card.type === 'tag' && 'tag_info' in card && card.conditional != 'EXCEPT') {
          tagsIds.push(...card.tag_info.map((tagInfo) => tagInfo.id));
        }
      }
    }

    return tagsIds;
  }

  async createBatches(campaign: Campaign): Promise<string> {
    const redisClient = this.redisService.getOrThrow();
    const redisKey = `campaign:${campaign.id}`;
    const campaiKey = await redisClient.get(redisKey);
    if (campaiKey) {
      const messageErrorProcess = `Duplicated Campaign: (${campaign.id}) ${campaign.title}`;
      console.error(messageErrorProcess);
      return messageErrorProcess;
    }

    this.validateCampaign(campaign);
    const { testabMode } = campaign;

    if (!testabMode && campaign.campaignMessage.length > 1) {
      const campaignMessage = campaign.campaignMessage.find((item) => item.winner == true);
      campaign.campaignMessage = [campaignMessage || campaign.campaignMessage[0]];
    }

    if (![CampaignType.SPLIT, CampaignType.TESTAB].includes(campaign.type)) {
      campaign.testabLastId = null;
      campaign.testabinInitialPageId = null;
    }

    const totalContacts = await this.msgopsService.countByTags(campaign, campaign?.testabLastId || 0, campaign?.testabinInitialPageId || 0);
    if (totalContacts.length < 1) {
      this.formatterUtils.logInfo(`Contacts not found for campaign ${campaign.title}`);
      throw new NotFoundException(`Contacts not found for tags ${campaign.title}`);
    }

    const totalPages = totalContacts.length;

    if (campaign.type === CampaignType.TESTAB && totalPages <= 5) {
      campaign.spreadSending = 5 * totalPages;
    }

    const millisecond = campaign.spreadSending * 60000 || 60000;

    const distribute = Math.ceil(millisecond / totalPages);

    let idFirstPage = totalContacts.length > 1 ? totalContacts[1].order_number + 1 : 0;
    if (campaign.type === CampaignType.SPLIT) {
      idFirstPage = idFirstPage == 0 ? campaign.testabLastId + 1 : idFirstPage;
      campaign.testabMode = false;
    }

    if (campaign.type === CampaignType.TESTAB && totalPages === 1) {
      idFirstPage = campaign?.testabLastId || 0;
    }

    await this.addPageToQueue(campaign, 1, totalPages, distribute, idFirstPage, totalContacts[0].order_number);
    totalContacts.shift();

    if (totalPages > 1) {
      const finalPageFinalId = totalContacts[totalContacts.length - 1].order_number;
      if (!testabMode) {
        totalContacts.pop();
      }

      let countPages = 1;
      let delay = 0;
      const delayIncrement = 5;

      await Promise.all(
        totalContacts.map(async (contact) => {
          const arrayPage = countPages;
          const currentPage = countPages + 1;
          countPages++;

          const waitFor = Math.ceil(currentPage * distribute);

          let currentContactId = totalContacts.length > arrayPage ? totalContacts[arrayPage].order_number + 1 : 0;
          if (testabMode && currentContactId === 0 && campaign.testabLastId > 0) {
            currentContactId = campaign.testabLastId + 1;
          }

          if (!testabMode && currentContactId === 0) {
            currentContactId = finalPageFinalId + 1;
          }

          const finalContactId = contact.order_number;
          delay += delayIncrement;

          return new Promise((resolve) => setTimeout(resolve, delay)).then(async () => {
            await this.addPageToQueue(campaign, currentPage, totalPages, waitFor, currentContactId, finalContactId);
          });
        }),
      );

      if (!testabMode) {
        const lastContactId = campaign.testabLastId ? campaign.testabLastId + 1 : 0;
        await this.addPageToQueue(campaign, totalPages, totalPages, Math.ceil((countPages + 1) * distribute + 600000), lastContactId, finalPageFinalId);
      }
    }

    this.formatterUtils.logInfo(`Generated ${totalPages} pages to be processed.`);

    try {
      if (!testabMode) {
        await redisClient.set(redisKey, 'true', 'EX', 60 * campaign.spreadSending || 60);
      }
    } catch (error) {
      this.formatterUtils.logInfo(`[${campaign.id}] Unable to save in Redis.`, error);
      return;
    }

    return `Processed ${totalPages} pages`;
  }

  async addPageToQueue(campaign: Campaign, page: number, totalPages: number, delayMs: number, currentContactId: number, finalContactId: number) {
    const data: CampaignBatch = { campaign, page, totalPages, currentContactId, finalContactId };
    const jobId = await this.queuePublisher.addSchedulePage(data, delayMs);
    this.formatterUtils.logInfo(`Page ${page} queued with job id ${jobId}`);
    return jobId;
  }

  async processPage(campaignBatch: CampaignBatch): Promise<{ [K: string]: any }> {
    const redisClient = this.redisService.getOrThrow();
    const stopCampaign = await redisClient.get(`stop_campaign_${campaignBatch.campaign.id}`);
    if (stopCampaign) {
      this.formatterUtils.logInfo(`[Process Page] Stop processing campaign: ${campaignBatch.campaign.id}`);
      return {};
    }
    this.validateData(campaignBatch);

    await this.mountPackages(campaignBatch);
    const toReturn = {
      audiences: campaignBatch.campaign.audiences,
      contacts: this.contactsLength,
      packages: this.packagesLength,
    };
    return toReturn;
  }

  async getContacts(campaign: Campaign, currentContactId: number, finalContactId: number): Promise<ContactEntity[]> {
    try {
      return await this.msgopsService.findByTags(campaign, currentContactId, finalContactId);
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException(`Exception when trying retrieve contacts`, err);
    }
  }

  async mountPackages(campaignBatch: CampaignBatch) {
    const message = campaignBatch.campaign.campaignMessage[0].message;

    const contacts: ContactEntity[] = await this.getContacts(campaignBatch.campaign, campaignBatch.currentContactId, campaignBatch.finalContactId);

    const contactsUnique = [...new Map(contacts.map((contact) => [contact.id, contact])).values()];

    const currentpackage = {
      account: campaignBatch.campaign.account || {},
      campaign: campaignBatch.campaign,
      campaign_id: campaignBatch.campaign.id,
      campaign_name: campaignBatch.campaign.name,
      campaign_test_ab_mode: campaignBatch.campaign.testabMode || false,
      contacts: contactsUnique,
      page: campaignBatch.page,
      totalPages: campaignBatch.totalPages,
      message,
    };

    this.formatterUtils.logInfo(
      `[Process Page] Campaign: ${campaignBatch.campaign.id} - Page: ${campaignBatch.page} - Contacts: ${contactsUnique.length} - First ID: ${campaignBatch.currentContactId} - Last ID: ${campaignBatch.finalContactId}`,
    );
    const redisClient = this.redisService.getOrThrow();
    const pubSubMessage = {
      campaignKey: `campaign-${currentpackage.campaign_id}-${currentpackage.page}-${Date.now()}`,
      campaign: currentpackage.campaign_id,
      page: currentpackage.page,
      initialContactId: campaignBatch.currentContactId,
      finalContactId: campaignBatch.finalContactId,
    };
    await redisClient.set(pubSubMessage.campaignKey, JSON.stringify(currentpackage), 'EX', 43200);
    await this.eventPublisher.publish(EXCHANGES.campaigns, 'campaign.send', pubSubMessage);
    this.formatterUtils.logInfo(`Message ${pubSubMessage.campaignKey} published to ${EXCHANGES.campaigns}/campaign.send.`);

    await this.sendTracker(1, this.contactsLength, campaignBatch.campaign.id, 'CAMPAIGN_PACKAGED');

    return true;
  }

  async createTest(id: number) {
    const campaign = await this.msgopsService.getCampaign(id);
    const campaignParse = JSON.parse(JSON.stringify(campaign));
    const percentTest = campaignParse.testabAudiencePercent / 100;
    const messages = JSON.parse(JSON.stringify(campaignParse.campaignMessage));

    if (campaign.type === CampaignType.TESTAB) {
      const redisClient = this.redisService.getOrThrow();
      const defaultStatistics = { open: 0, click: 0, delivered: 0, bounce: 0, unsubscribe: 0 };
      for (const message of campaign.campaignMessage) {
        await redisClient.hset(`testab:campaign:${message.campaignId}:message:${message.messageId}`, defaultStatistics);
      }
      const testabScheduleTo = new Date(campaignParse.testabScheduleTo);
      const testabScheduleEnd = new Date(campaignParse.scheduleTo);
      const minutes = (testabScheduleEnd.getTime() - testabScheduleTo.getTime()) / (1000 * 60);
      if (minutes < campaignParse.spreadSending) {
        campaignParse.spreadSending = Math.round(minutes);
      }
    }

    await this.msgopsService.createContactsSend(campaign);
    const pagesMessageTest = await this.msgopsService.startedTestAB(campaignParse.id, campaignParse.campaignMessage.length, percentTest);

    for (const [index, page] of pagesMessageTest.entries()) {
      const nextId = pagesMessageTest.length - 1 >= index + 1 ? pagesMessageTest[index + 1].order_number : 0;
      campaignParse.testabinInitialPageId = page.order_number;
      campaignParse.testabLastId = nextId;
      campaignParse.campaignMessage = [messages[index]];
      campaignParse.testabMode = true;
      await this.createBatches(JSON.parse(JSON.stringify(campaignParse)));
    }
    await this.msgopsService.updateCampaign(campaign.id, { testabLastId: pagesMessageTest[0].order_number });
    const isTestabType = campaign.type === CampaignType.SPLIT ? false : true;
    await this.sendTracker(0, 0, campaign.id, 'CAMPAIGN_PROCESSING_STARTED', isTestabType);

    return `Process test campaign: ${campaign.id}`;
  }

  async processResult(id: number) {
    const redisClient = this.redisService.getOrThrow();
    const currentDate = new Date();
    const campaign = await this.msgopsService.getCampaign(id);
    const campaignMessage: any = campaign.campaignMessage;
    for (const message of campaignMessage) {
      message.statistics = await redisClient.hgetall(`testab:campaign:${message.campaignId}:message:${message.messageId}`);
    }

    const winnerMessage = campaignMessage.reduce((prev, current) =>
      parseInt(prev.statistics[campaign.testabCriteria]) > parseInt(current.statistics[campaign.testabCriteria]) ? prev : current,
    );
    for (const item of campaignMessage) {
      item.winner = false;
      item.resultDate = currentDate;
      if (item.messageId == winnerMessage.messageId) {
        item.winner = true;
      }
      await this.msgopsService.updateCampaignMessage(item);
      await redisClient.del(`testab:campaign:${item.campaignId}:message:${item.messageId}`);
    }

    if (!campaign.testabSentAfterTest) {
      await this.msgopsService.updateCampaign(campaign.id, { status: CampaignStatus.Completed });
      return `Process result campaign ${campaign.id}.`;
    }

    const diffMs = dayjs(campaign.scheduleTo.toString()).tz('America/Sao_Paulo').diff(dayjs().tz('America/Sao_Paulo'), 'millisecond');
    const jobId = await this.queuePublisher.addCampaignTrigger(campaign.id, diffMs);

    return `Process result campaign ${campaign.id}. Trigger job: ${jobId}`;
  }

  validateCampaign(campaign: Campaign) {
    if (
      campaign.messageType === CampaignMessageType.EMAIL &&
      !campaign.campaignMessage[0].message.content &&
      (!campaign.campaignMessage[0].message.fileName || !campaign.campaignMessage[0].message.bucketName)
    ) {
      throw new BadRequestException('Email must contain location object with fileName and bucketName', JSON.stringify(campaign));
    }

    if (!campaign.query) {
      throw new BadRequestException('Campaigns must have at least one audience', JSON.stringify(campaign.audiences));
    }
  }

  validateData(data: CampaignBatch) {
    if (!('page' in data)) {
      throw new BadRequestException('CampaignBatch must have a page', JSON.stringify(data));
    }

    this.validateCampaign(data.campaign);
  }

  async sendTracker(packagesLength: number, contactsLength: number, campaignId: number, event: string, testabMode = false) {
    try {
      const tracker = {
        campaign_id: campaignId,
        service: 'MSGOPS_CAMPAIGN_PACKER',
        event,
        timestamp: new Date().getTime(),
        audiences: [],
        contacts_length: contactsLength,
        packages_length: packagesLength,
        package_id: null,
        email_id: null,
        email_subject: null,
        cloud_run: process.env.CLOUD_RUN,
        PORT: process.env.PORT,
        k_revision: process.env.K_REVISION,
        k_configuration: process.env.K_CONFIGURATION,
        testabMode,
      };

      await this.eventPublisher.publish(EXCHANGES.campaigns, 'campaign.tracked', tracker);
      console.info(`amqp ${EXCHANGES.campaigns}/campaign.tracked published`);
    } catch (error) {
      this.formatterUtils.logInfo(`Error to use service tracker`, error);
    }
  }
}
