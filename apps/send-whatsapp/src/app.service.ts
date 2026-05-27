import { Injectable, Logger } from '@nestjs/common';
import { Account, CampaignMessage, AutomationMessage, Contact } from './interfaces';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from './event-publisher.service';
import { MsgopsService } from './msgops/msgops.service';
import { Utils } from './utils/index.utils';

interface CreateRedirectLinkOptions {
  url: string;
  utmsDefault: string;
  type: string;
  utmCampaign: string;
  baseUrl: string;
  account: Account;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly eventPublisher: EventPublisherService,
    private readonly msgopsService: MsgopsService,
    private readonly utils: Utils,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  // WhatsApp sending via Evolution API has been removed. The replacement
  // WhatsappCloudProvider (Meta Cloud API + EvoHub proxy mode) is wired up
  // in Wave 5; until it lands, campaign and automation publishes for WhatsApp
  // are acknowledged but not delivered, and an explicit log lets ops know.
  async processCampaign(campaignMessage: CampaignMessage) {
    const accountId = campaignMessage?.account?.id;
    const messageId = campaignMessage?.message?.id;
    this.logger.warn(`processCampaign: WhatsApp Cloud provider not yet wired (Wave 5); skipping account=${accountId} message=${messageId}`);
    return { status: 503, message: 'WhatsApp Cloud provider not yet wired (Wave 5)' };
  }

  async processAutomation(automationMessage: AutomationMessage) {
    const { contact, message } = automationMessage;

    if (!contact?.hasWhatsapp) {
      return await this.invalidContact(contact, automationMessage);
    }

    this.logger.warn(`processAutomation: WhatsApp Cloud provider not yet wired (Wave 5); skipping account=${automationMessage?.account?.id} message=${message?.id}`);

    if (automationMessage.next?.pubName) {
      await this.eventPublisher.publish(EXCHANGES.triggers, 'trigger.process', automationMessage.next.data);
    }

    return { status: 503, message: 'WhatsApp Cloud provider not yet wired (Wave 5)' };
  }

  async invalidContact(contact: Contact, automationMessage: AutomationMessage) {
    const messageNextError = `[${automationMessage.messageId}] Invalid contact: ${contact?.id}.`;
    this.logger.warn(messageNextError);
    if (automationMessage.next?.pubName) {
      await this.eventPublisher.publish(EXCHANGES.triggers, 'trigger.process', automationMessage.next.data);
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

  async sendTracker(event: string, campaignMessage: CampaignMessage, totalSent: number, data?: any) {
    const tracker = {
      campaign_id: campaignMessage.campaign_id,
      service: 'MSGOPS_SEND_BATCH_WHATSAPP',
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

    await this.eventPublisher.publish(EXCHANGES.campaigns, 'campaign.tracked', tracker);
    return { status: true, message: 'tracker published to bms.campaigns/campaign.tracked' };
  }

  async createRedirectLink(opts: CreateRedirectLinkOptions) {
    let { url } = opts;
    const { utmsDefault, type, utmCampaign, baseUrl } = opts;
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
}
