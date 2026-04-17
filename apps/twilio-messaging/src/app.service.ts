import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './providers/redis/redis.service';
import {
  Account,
  CampaignMessage,
  CampaignMessageType,
  AutomationMessage,
  Contact,
  SingleMessage,
  CompressedAutomationPayload,
} from './interfaces';
import { MsgopsService } from './msgops/msgops.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { Utils } from './utils/index.utils';

@Injectable()
export class AppService {
  private redisClient: Redis;

  constructor(
    private readonly pubSubProvider: PubSubProvider,
    private readonly redisService: RedisService,
    private readonly msgopsService: MsgopsService,
    private readonly utils: Utils,
  ) {
    this.redisClient = this.redisService.getClient();
  }

  getHello(): string {
    return 'Hello World!';
  }

  async processCampaign(campaignMessage: CampaignMessage, redisKeyPayload: string) {
    console.log('Log - campaignMessage', JSON.stringify(campaignMessage));
    const { account, message } = campaignMessage;
    const twilioSecret = this.configByName(account, 'twilio_secret');
    const twilioSidAccount = this.configByName(account, 'twilio_sid_account');
    const twilioSid = this.configByName(account, 'twilio_sid');
    const twilioProvider = new TwilioProvider(twilioSecret, twilioSid, twilioSidAccount);
    const typeMessage = message.type == CampaignMessageType.WHATSAPP ? 'twilio_whatsapp_service' : 'twilio_sms_service';
    const twilioService = this.configByName(account, typeMessage);

    const domain = this.configByName(account, 'default_domain');
    const response = await Promise.all(
      campaignMessage.contacts.map(async (contact) => {
        const shortUtms = `platform=twilio&message_type=${message.type}&type=campaign&contactId=${contact.id}&uuid=${contact.uuid}&account=${account.id}&id=${message.name}&message=${message.id}&campaign_type=${campaignMessage.campaign?.type}&campaign=${campaignMessage.campaign?.id}&domain=${domain}`;
        const defaultUtmCampaign = `${campaignMessage.campaign?.name || campaignMessage.campaign_name}_e1_${message.id}`;
        const utmsCallback = shortUtms + `&utmcampaign=${defaultUtmCampaign}`;

        if (message.type == CampaignMessageType.WHATSAPP) {
          const shortCode = message.url
            ? await this.createRedictLink(message.url, shortUtms, message.type, defaultUtmCampaign, '')
            : null;
          return await twilioProvider.sendSingleWhatsapp(
            message.providerMessageId,
            contact.whatsapp,
            utmsCallback,
            twilioService,
            shortCode,
          );
        }

        let content = this.utils.parseVariables(message.content, contact, account);
        if (message.url) {
          const baseUrl = this.configByName(account, 'shortlink_base_url');
          const link = await this.createRedictLink(message.url, shortUtms, message.type, defaultUtmCampaign, baseUrl);
          content += ` ${link}`;
        }
        return await twilioProvider.sendSingleSms(content, contact.phone, utmsCallback, twilioService);
      }),
    );
    // await this.processResponse(response);
    const trackerKey =
      campaignMessage.message.type == CampaignMessageType.WHATSAPP ? 'SENT_WHATSAPP_BATCH' : 'SENT_SMS_BATCH';
    await this.sendTracker(trackerKey, campaignMessage, response.length);
    if (redisKeyPayload) {
      await this.redisClient.del(redisKeyPayload);
    }
    return { status: 201, message: 'ok' };
  }

  async processAutomation(automationMessage: AutomationMessage, redisKeyPayload: string) {
    const { account, contact, message } = automationMessage;
    const twilioSecret = this.configByName(account, 'twilio_secret');
    const twilioSid = this.configByName(account, 'twilio_sid');
    const twilioSidAccount = this.configByName(account, 'twilio_sid_account');
    const twilioProvider = new TwilioProvider(twilioSecret, twilioSid, twilioSidAccount);

    const typeMessage = message.type == CampaignMessageType.WHATSAPP ? 'twilio_whatsapp_service' : 'twilio_sms_service';
    const twilioService = this.configByName(account, typeMessage);

    const domain = this.configByName(account, 'default_domain');
    const shortUtms = `platform=twilio&message_type=${message.type}&type=automation&contactId=${contact.id}&uuid=${contact.uuid}&account=${account.id}&id=${message.name}&message=${message.id}&automation=${automationMessage.automationId}&automationName=${automationMessage.automationName}&automationType=${automationMessage.automationType}&domain=${domain}&utm_content=${automationMessage.utmContent}`;
    const defaultUtmCampaign = `${automationMessage.utmCampaign}`;
    const utmCallback = shortUtms + `&utmcampaign=${defaultUtmCampaign}`;

    if (message.type == CampaignMessageType.WHATSAPP) {
      if (!contact.hasWhatsapp) {
        return await this.invalidContact(contact, automationMessage);
      }
      const shortCode = message.url
        ? await this.createRedictLink(message.url, shortUtms, message.type, defaultUtmCampaign, '')
        : null;
      await twilioProvider.sendSingleWhatsapp(
        message.providerMessageId,
        contact.whatsapp,
        utmCallback,
        twilioService,
        shortCode,
      );
    }

    if (message.type == CampaignMessageType.SMS) {
      let content = this.utils.parseVariables(message.content, contact, account);
      if (message.url) {
        const baseUrl = this.configByName(account, 'shortlink_base_url');
        const link = await this.createRedictLink(message.url, shortUtms, message.type, defaultUtmCampaign, baseUrl);
        content += ` ${link}`;
      }

      if (!contact.hasPhone) {
        return await this.invalidContact(contact, automationMessage);
      }
      await twilioProvider.sendSingleSms(content, contact.phone, utmCallback, twilioService);
    }

    if (!automationMessage.next || !automationMessage.next?.pubName) {
      const messageNextError = `[${automationMessage.messageId}] This message does not have the next filled in.`;
      return { status: true, message: messageNextError };
    }

    const compressPayload = {
      automationKey: `automation-${automationMessage?.next?.data?.id || 0}-${automationMessage?.next?.data?.contact?.id || 0}-${Date.now()}`,
    } as CompressedAutomationPayload;
    await this.redisClient.set(compressPayload.automationKey, JSON.stringify(automationMessage.next.data), 'EX', 43200);
    const messageId = await this.pubSubProvider.sendMessage(compressPayload, automationMessage.next.pubName);
    if (redisKeyPayload) {
      await this.redisClient.del(redisKeyPayload);
    }

    return {
      status: true,
      message: `${messageId} send to ${automationMessage.next.pubName}.`,
    };
  }

  async processSingleSms(message: SingleMessage, redisKeyPayload: string) {
    const twilioSecret = this.configByName(message.account, 'twilio_secret');
    const twilioSid = this.configByName(message.account, 'twilio_sid');
    const twilioSidAccount = this.configByName(message.account, 'twilio_sid_account');
    const twilioService = this.configByName(message.account, 'twilio_sms_service');
    const twilioProvider = new TwilioProvider(twilioSecret, twilioSid, twilioSidAccount);

    const twillioReturn = await twilioProvider.sendSingleSms(
      message.body,
      message.to,
      'platform=twilio&message_type=sms&type=single',
      twilioService,
    );
    if (redisKeyPayload) {
      await this.redisClient.del(redisKeyPayload);
    }

    return twillioReturn;
  }

  async invalidContact(contact: Contact, automationMessage: AutomationMessage) {
    const messageNextError = `[${automationMessage.messageId}] Invalid contact: ${contact.id}.`;
    console.log(messageNextError);
    if (automationMessage.next && automationMessage.next?.pubName) {
      await this.pubSubProvider.sendMessage(automationMessage.next.data, automationMessage.next.pubName);
    }
    return { status: true, message: messageNextError };
  }

  configByName(account: Account, key: string) {
    if (Array.isArray(account.accountConfigs)) {
      const find = account.accountConfigs.find((config) => config.name === key);
      return find?.value || '';
    }

    return account.accountConfigs[key];
  }

  // async processResponse(response: any): Promise<void> {
  //TODO: event definition
  // }

  async sendTracker(event: string, campaignMessage: CampaignMessage, totalSent: number, data?: any) {
    const tracker = {
      campaign_id: campaignMessage.campaign_id,
      service: 'MSGOPS_SEND_BATCH_TWILIO',
      event: event,
      timestamp: new Date().getTime(),
      audiences: [],
      contacts_length: totalSent,
      packages_length: null,
      package_id: null,
      email_id: campaignMessage.message.id,
      email_subject: campaignMessage.message.content,
      page: campaignMessage.page,
      totalPages: campaignMessage.totalPages,
      data: data,
      testabMode: campaignMessage.campaign_test_ab_mode,
    };

    return await this.pubSubProvider.sendMessage(tracker, process.env.TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER);
  }

  async createRedictLink(url: string, utmsDefault: string, type: string, utmCampaign: string, baseUrl: string) {
    url += url.includes('?') ? `&${utmsDefault}` : `?${utmsDefault}`;
    if (!url.includes('utm_source')) {
      url += '&utm_source=bms';
    }
    if (!url.includes('utm_medium')) {
      url += `&utm_medium=${type}`;
    }
    if (!url.includes('utm_campaign')) {
      url += `&utm_campaign=${utmCampaign}`;
    }
    return await this.msgopsService.createShortLink(url, baseUrl);
  }

  async getRedis(redisKey) {
    const originalPayload = await this.redisClient.get(redisKey).then((payload) => {
      if (payload) {
        return JSON.parse(payload);
      }
    });

    return originalPayload;
  }
}
