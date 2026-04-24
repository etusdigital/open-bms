import { Injectable } from '@nestjs/common';
import { addTrailingSlash } from '@msgops/url-utils';
import { Account, CampaignMessage, CampaignMessageType, AutomationMessage, Contact } from './interfaces';
import { MsgopsService } from './msgops/msgops.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { Utils } from './utils/index.utils';
import { EvolutionProvider } from './providers/evolution.provider';

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
  constructor(
    private readonly pubSubProvider: PubSubProvider,
    private readonly msgopsService: MsgopsService,
    private readonly utils: Utils,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async processCampaign(campaignMessage: CampaignMessage) {
    console.log('Log - campaignMessage', JSON.stringify(campaignMessage));
    const { account, message } = campaignMessage;
    const evolutionInstanceName = this.configByName(account, 'whatsapp_number_id');
    const evolutionApiKey = this.configByName(account, 'whatsapp_access_token');
    const language = this.configByName(account, 'default_language') || 'pt_BR';
    const evolutionProvider = new EvolutionProvider(evolutionInstanceName, evolutionApiKey);

    if (!evolutionInstanceName || !evolutionApiKey) {
      return { status: 400, message: 'Invalid account configuration' };
    }

    const domain = this.configByName(account, 'default_domain');
    const response = await Promise.all(
      campaignMessage.contacts.map(async (contact) => {
        const shortUtms = `platform=evolution&message_type=${message.type}&type=campaign&contactId=${contact.id}&uuid=${contact.uuid}&account=${account.id}&id=${message.name}&message=${message.id}&campaign_type=${campaignMessage.campaign?.type}&campaign=${campaignMessage.campaign?.id}&domain=${domain}`;
        const defaultUtmCampaign = `${campaignMessage.campaign?.name || campaignMessage.campaign_name}_e1_${message.id}`;
        const utmsCallback = shortUtms + `&utmcampaign=${defaultUtmCampaign}`;

        const shortCode = message.url
          ? await this.createRedirectLink({
              url: message.url,
              utmsDefault: shortUtms,
              type: message.type,
              utmCampaign: defaultUtmCampaign,
              baseUrl: '',
              account,
            })
          : null;
        return await evolutionProvider.sendWhatsappTemplate(message.providerMessageId, language, contact.whatsapp, utmsCallback, shortCode);
      }),
    );
    // await this.processResponse(response);
    const trackerKey = campaignMessage.message.type == CampaignMessageType.WHATSAPP ? 'SENT_WHATSAPP_BATCH' : 'SENT_SMS_BATCH';
    await this.sendTracker(trackerKey, campaignMessage, response.length);
    return { status: 201, message: 'ok' };
  }

  async processAutomation(automationMessage: AutomationMessage) {
    const { account, contact, message } = automationMessage;
    const evolutionInstanceName = this.configByName(account, 'whatsapp_number_id');
    const evolutionApiKey = this.configByName(account, 'whatsapp_access_token');
    const language = this.configByName(account, 'default_language') || 'pt_BR';
    const evolutionProvider = new EvolutionProvider(evolutionInstanceName, evolutionApiKey);

    if (!evolutionInstanceName || !evolutionApiKey) {
      return { status: 400, message: 'Invalid account configuration' };
    }

    const domain = this.configByName(account, 'default_domain');
    const shortUtms = `platform=evolution&message_type=${message.type}&type=automation&contactId=${contact.id}&uuid=${contact.uuid}&account=${account.id}&id=${message.name}&message=${message.id}&automation=${automationMessage.automationId}&automationName=${automationMessage.automationName}&automationType=${automationMessage.automationType}&domain=${domain}&utm_content=${automationMessage.utmContent}`;
    const defaultUtmCampaign = `${automationMessage.utmCampaign}`;
    const utmCallback = shortUtms + `&utmcampaign=${defaultUtmCampaign}`;

    if (!contact.hasWhatsapp) {
      return await this.invalidContact(contact, automationMessage);
    }
    const shortCode = message.url
      ? await this.createRedirectLink({
          url: message.url,
          utmsDefault: shortUtms,
          type: message.type,
          utmCampaign: defaultUtmCampaign,
          baseUrl: '',
          account,
        })
      : null;
    await evolutionProvider.sendWhatsappTemplate(message.providerMessageId, language, contact.whatsapp, utmCallback, shortCode, contact.code);

    if (!automationMessage.next || !automationMessage.next?.pubName) {
      const messageNextError = `[${automationMessage.messageId}] This message does not have the next filled in.`;
      return { status: true, message: messageNextError };
    }

    const messageId = await this.pubSubProvider.sendMessage(automationMessage.next.data, automationMessage.next.pubName);

    return {
      status: true,
      message: `${messageId} send to ${automationMessage.next.pubName}.`,
    };
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
      service: 'MSGOPS_SEND_BATCH_EVOLUTION',
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

  async createRedirectLink(opts: CreateRedirectLinkOptions) {
    let { url } = opts;
    const { utmsDefault, type, utmCampaign, baseUrl, account } = opts;
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
    if (account.isInternal) {
      url = addTrailingSlash(url);
    }
    return await this.msgopsService.createShortLink(url, baseUrl);
  }
}
