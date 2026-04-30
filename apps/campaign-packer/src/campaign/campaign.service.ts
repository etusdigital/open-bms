import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Campaign, CampaignBatch, CampaignMessageType, CampaignStatus, CampaignType } from '../interfaces';
import { MsgopsService } from '../msgops/msgops.service';
import { ContactEntity } from '../msgops/entities/contact.entity';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { RedisService } from '../providers/redis/redis.service';
import { CampaignMessageEntity } from 'src/msgops/entities/campaign-message.entity';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { CampaignEntity } from 'src/msgops/entities/campaign.entity';
import { WarmupEntity } from 'src/msgops/entities/warmup.entity';
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

    // TODO: WARMUP POOL TARJETASARGENTINAS
    if (campaign.accountId == 60 && campaign.messageType == CampaignMessageType.EMAIL) {
      const campaignTags = this.getTagsInCampaign(campaign.steps);
      if (campaignTags.includes(6358) && campaign.campaignMessage.length) {
        for (const messages of campaign.campaignMessage) {
          messages.message.ippool = 'em01_tarjetasargentinas_com_warmup';
        }
      }
    }

    let quantityContacts = 0;
    if (campaign.type === CampaignType.SIMPLE || campaign.type === CampaignType.RECURRING) {
      const createReturn = await this.msgopsService.createContactsSend(campaign);
      quantityContacts = createReturn.length;
    } else if (campaign.type === CampaignType.TESTAB) {
      quantityContacts = await this.msgopsService.countContactsTestAb(campaign.id, campaign.testabLastId);
    }

    await this.sendTracker(0, 0, campaign.id, 'CAMPAIGN_PROCESSING_STARTED');
    const canWarmupType = this.canRunWarmups(campaign, quantityContacts);
    if (canWarmupType !== 'never') {
      const timeZone = campaign.account.configByName('time_zone') || 'UTC';
      this.formatterUtils.logInfo(`[WARMUP-CAMPAIGN] - CAMPAIGN: ${campaign.id} - QUANTITY: ${quantityContacts}`);
      const currentDate = dayjs().tz(timeZone).format('YYYY-MM-DD');
      let warmups = await this.msgopsService.getWarmupsAccount(quantityContacts * 0.1, campaign.accountId, currentDate, canWarmupType);

      if (warmups.length === 0) {
        const firstWarmup = await this.msgopsService.findFirstWarmup(campaign.accountId, currentDate, canWarmupType);
        if (firstWarmup) {
          campaign['maxContactsWarmup'] = this.definedMaxContactsWarmup(firstWarmup, quantityContacts);
          warmups = [firstWarmup];
          if (firstWarmup.type === 'internal' && firstWarmup.stage === 1) {
            await this.msgopsService.updateWarmup(firstWarmup.id, { stage: 2 });
          }
        }
      }

      if (warmups.length) {
        const redisClient = this.redisService.getOrThrow();
        const warmupsIds = [];
        const campaignTags = this.getTagsInCampaign(campaign.steps);
        for (const warmup of warmups) {
          if (warmup.target_segment_id == null || (warmup.target_segment_id != null && campaignTags.includes(warmup.target_segment_id))) {
            const expireRedisKey = warmup?.campaign?.spreadSending ? warmup.campaign.spreadSending * 60 : 28800;
            const redisKey = `warmup:${warmup.id}`;
            const hasWarmup = await redisClient.exists(redisKey);
            if (!hasWarmup) {
              await redisClient.set(redisKey, campaign.id, 'EX', expireRedisKey);
              warmupsIds.push(warmup.id);
            }
          }
        }

        if (warmupsIds.length) {
          return this.queuePublisher.addCampaignPackerWarmup({ warmups: warmupsIds, campaign });
        }
      }
    }

    return this.queuePublisher.addCampaignPacker(campaign);
  }

  definedMaxContactsWarmup(warmup: WarmupEntity, quantityContacts) {
    if (warmup.stage === 3 && warmup.remainingSendToday > quantityContacts) {
      return Math.round(quantityContacts * 0.9);
    }

    if (warmup.stage === 3) {
      return warmup.remainingSendToday;
    }

    return Math.round(quantityContacts * 0.1);
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

  async warmupStart(campaign: Campaign, warmupsIds: Array<number>) {
    this.formatterUtils.logInfo(`[WARMUP-CAMPAIGN] - WARMUPS: ${warmupsIds} - CAMPAIGN: ${campaign.id}`);
    const originalCampaign = JSON.parse(JSON.stringify(campaign));
    const originalMessage = { ...originalCampaign.campaignMessage[0].message };
    const campaignDefault = { fromMail: originalMessage.fromMail, ippool: originalMessage.ippool, replyTo: originalMessage.replyTo, id: campaign.id, originalMessage: null };
    const warmups = await this.msgopsService.findWarmupByIds(warmupsIds, campaign.accountId);
    for (const warmup of warmups) {
      this.formatterUtils.logInfo(`[START-WARMUP] - ID:${warmup.id} - POOL: ${warmup.ippool} - CAMPAIGN: ${campaign.id} - 
      QUANTITY: ${campaign.maxContactsWarmup && campaign.maxContactsWarmup < warmup.remainingSendToday ? campaign.maxContactsWarmup : warmup.remainingSendToday}`);
      const redisClient = this.redisService.getOrThrow();
      const hasWarmup = await redisClient.get(`warmup:${warmup.id}`);
      if (hasWarmup && hasWarmup == `${campaign.id}`) {
        await this.msgopsService.processWarmup(warmup, campaign);
        const quantitySend = Array.isArray(warmup.warmupInfo) ? warmup.warmupInfo.length : 0;
        const { campaign: warmupCampaign } = warmup;
        let message = { ...campaign.campaignMessage[0] };
        if (campaign.type === CampaignType.TESTAB) {
          const campaignMessage = campaign.campaignMessage.find((item) => item.winner == true);
          message = campaignMessage ? { ...campaignMessage } : ({ ...campaign.campaignMessage[0] } as CampaignMessageEntity);
        }

        if (warmup.stage === 0 || warmup.stage == null) {
          campaignDefault.originalMessage = { ...message.message };
          const defaultMessagesIds = process.env.DEFAULT_WARMUP_MESSAGES.split(',');
          const indexMessage = quantitySend < defaultMessagesIds.length ? quantitySend : Math.floor(Math.random() * defaultMessagesIds.length);
          message.message = await this.msgopsService.findMessageById(defaultMessagesIds[indexMessage]);
        }

        const warmupMessage = {
          ...message,
          message: {
            ...message.message,
            fromMail: warmup.sender,
            ippool: warmup.ippool,
            replyTo: warmup.replyTo,
          },
        } as CampaignMessageEntity;

        if (warmup.type === 'internal' && warmup.stage === 2) {
          const nextSpreading = warmupCampaign.spreadSending - 60;
          warmupCampaign.spreadSending = nextSpreading > 60 ? nextSpreading : 60;
          await this.msgopsService.updateCampaign(warmupCampaign.id, { spreadSending: warmupCampaign.spreadSending });
        }

        warmupCampaign.campaignMessage = [warmupMessage];
        warmupCampaign.title = campaign.title;
        warmupCampaign.name = campaign.name;
        warmupCampaign['campaignDefault'] = campaignDefault;
        warmupCampaign['warmupTarget'] = warmup.currentSend;
        warmupCampaign['warmupSegmentId'] = warmup.target_segment_id;
        warmupCampaign['stage'] = warmup.stage;

        const remainingSendToday =
          campaign.maxContactsWarmup && campaign.maxContactsWarmup < warmup.remainingSendToday ? warmup.remainingSendToday - campaign.maxContactsWarmup : 0;
        await this.msgopsService.updateWarmup(warmup.id, {
          remainingSendToday,
          status: 'running',
          ...(warmup.stage === 3 || remainingSendToday > 0 ? {} : { lastSentAt: new Date() }),
          ...(warmup.stage !== 3 && warmup.type === 'internal' && warmupCampaign.spreadSending <= campaign.spreadSending ? { stage: 3 } : {}),
          ...(warmup.stage === 0 && quantitySend == 6 ? { stage: null, currentSend: 160 } : {}),
        });

        await this.queuePublisher.addCampaignPacker(warmupCampaign);
        const redisExpireKey = warmupCampaign?.spreadSending ? warmupCampaign.spreadSending * 60 : 28800;
        await redisClient.set(`warmup:${warmup.id}`, 0, 'EX', redisExpireKey);
      }
    }

    await this.queuePublisher.addCampaignPacker(originalCampaign);
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

    let contactsWarmupCampaign = [];
    if (campaignBatch.campaign.isWarmup && campaignBatch.campaign.warmupTarget <= 2360) {
      const redisClient = this.redisService.getOrThrow();
      const redisKey = `warmup_contacts:${campaignBatch.campaign.id}`;
      const hasWarmupContacts = await redisClient.exists(redisKey);
      let defaultList = [];
      if (!hasWarmupContacts) {
        defaultList = await this.msgopsService.warmupContactsRandon(campaignBatch.campaign.warmupTarget);
        await redisClient.set(redisKey, JSON.stringify(defaultList), 'EX', 36000);
      } else {
        const warmupContacts = await redisClient.get(redisKey);
        defaultList = JSON.parse(warmupContacts);
      }

      const contactsPage = Math.floor(defaultList.length / campaignBatch.totalPages) || 1;
      const contactsDefault = defaultList.splice((campaignBatch.page - 1) * contactsPage, contactsPage);
      if (contactsDefault.length) {
        contactsWarmupCampaign = contactsUnique.splice(0, contactsPage);
      } else if (campaignBatch.campaign.stage === 0) {
        return true;
      }
      const contactsInternal = {
        warmup: campaignBatch.campaign.id,
        message: {
          id: message.id,
          subject: message.subject,
          email: message.fromMail,
          name: message.fromName,
        },
        recipients: [],
      };
      contactsDefault.forEach((contact, index) => {
        contactsUnique.push({
          ...contactsWarmupCampaign[index],
          firstName: contact.name,
          lastName: '',
          fullName: contact.name,
          email: contact.email,
          id: 0,
        } as ContactEntity);
        contactsInternal.recipients.push({ name: contact.firstName, email: contact.email });
      });
      if (contactsInternal.recipients.length) {
        await this.queuePublisher.addWarmupTracker(contactsInternal);
      }
    }

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
    const messageId = await this.queuePublisher.addSendMessage(pubSubMessage);
    this.formatterUtils.logInfo(`Message ${messageId} published.`);

    await this.sendTracker(1, this.contactsLength, campaignBatch.campaign.id, 'CAMPAIGN_PACKAGED');

    if (contactsWarmupCampaign.length) {
      currentpackage.campaign.id = campaignBatch.campaign.campaignDefault.id;
      currentpackage.message.fromMail = campaignBatch.campaign.campaignDefault.fromMail;
      currentpackage.message.ippool = campaignBatch.campaign.campaignDefault.ippool;
      currentpackage.campaign_id = campaignBatch.campaign.campaignDefault.id;
      currentpackage.message.replyTo = campaignBatch.campaign.campaignDefault.replyTo;
      if (campaignBatch.campaign.campaignDefault && campaignBatch.campaign.campaignDefault.originalMessage) {
        currentpackage.message = { ...campaignBatch.campaign.campaignDefault.originalMessage };
      }
      currentpackage.contacts = contactsWarmupCampaign;
      currentpackage['is_campaign_warmup_mode'] = true;
      const pubSubMessageWarmup = {
        campaignKey: `campaign-${currentpackage.campaign_id}-${currentpackage.page}-${Date.now()}`,
        campaign: currentpackage.campaign_id,
        page: currentpackage.page,
        initialContactId: campaignBatch.currentContactId,
        finalContactId: campaignBatch.finalContactId,
      };
      await redisClient.set(pubSubMessageWarmup.campaignKey, JSON.stringify(currentpackage), 'EX', 43200);
      await this.queuePublisher.addSendMessage(pubSubMessageWarmup);
    }

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

      const messageId = await this.queuePublisher.addEventsTracker(tracker);

      const response = `queue-campaign-events-tracker-jobid-${messageId}`;
      console.info(response);

      return messageId;
    } catch (error) {
      this.formatterUtils.logInfo(`Error to use service tracker`, error);
    }
  }

  canRunWarmups(campaign: CampaignEntity, quantityContacts: number) {
    if (campaign.messageType !== CampaignMessageType.EMAIL) {
      return 'never';
    }

    if (quantityContacts <= 0) {
      return 'never';
    }

    const timeZone = campaign.account.configByName('time_zone') || 'UTC';
    const now = dayjs().tz(timeZone);

    // only start warmups between 8am and 4:05pm
    const startTime = now.clone().hour(7).minute(59).second(59);
    const endTime = now.clone().hour(16).minute(5).second(0);

    const betweenInterval = now.isAfter(startTime) && now.isBefore(endTime);
    return betweenInterval ? 'general' : 'stage3';
  }
}
