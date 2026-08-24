import { Injectable, Logger } from '@nestjs/common';
import { Account, CampaignMessage, CampaignMessageType, AutomationMessage, Contact } from './interfaces';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from './event-publisher.service';
import { MsgopsService } from './msgops/msgops.service';
import { Utils } from './utils/index.utils';
import { WhatsappChannelResolverService } from './providers/whatsapp-channel-resolver.service';
import { WhatsappCloudProvider } from './providers/whatsapp-cloud.provider';
import { extractTemplateBody, extractTemplateVariables, sanitizeParameterText } from './utils/template-variables';
import { mapWithConcurrency } from './utils/concurrency';

const SEND_CONCURRENCY = Number(process.env.WHATSAPP_SEND_CONCURRENCY) || 10;

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
    private readonly channelResolver: WhatsappChannelResolverService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Wave 5 — campaign send through WhatsApp Cloud (meta direct OR EvoHub
   * proxy, transparent at this layer). Resolves the account's active
   * channel, builds the provider, fans out template sends one per contact.
   */
  async processCampaign(campaignMessage: CampaignMessage) {
    const accountId = campaignMessage?.account?.id;
    if (!accountId) {
      this.logger.error('processCampaign: missing account.id');
      return { status: 400, message: 'missing account.id' };
    }

    const { message, contacts } = campaignMessage;
    if (!message?.providerMessageId) {
      this.logger.error(`processCampaign: message ${message?.id} has no providerMessageId (template not synced with Meta yet)`);
      return { status: 422, message: 'template not synced with Meta — sync it before sending' };
    }

    let provider: WhatsappCloudProvider;
    let channelId: number;
    try {
      const built = await this.channelResolver.buildProvider(accountId);
      provider = built.provider;
      channelId = built.channel.id;
    } catch (err: any) {
      this.logger.error(`processCampaign: ${err?.message ?? 'channel resolution failed'}`);
      return { status: 400, message: err?.message ?? 'channel resolution failed' };
    }

    const language = this.configByName(campaignMessage.account, 'default_language') || 'pt_BR';
    const domain = this.configByName(campaignMessage.account, 'default_domain');

    const sent = await mapWithConcurrency(contacts, SEND_CONCURRENCY, async (contact) => {
      if (!contact.whatsapp || !contact.hasWhatsapp) {
        return { contactId: contact.id, skipped: 'no whatsapp on contact' };
      }
      const shortUtms = `platform=whatsapp_cloud&message_type=${message.type}&type=campaign&contactId=${contact.id}&uuid=${contact.uuid}&account=${accountId}&id=${message.name}&message=${message.id}&campaign_type=${campaignMessage.campaign?.type}&campaign=${campaignMessage.campaign?.id}&domain=${domain}`;
      const defaultUtmCampaign = `${campaignMessage.campaign?.name || campaignMessage.campaign_name}_e1_${message.id}`;
      const shortCode = message.url
        ? await this.createRedirectLink({
            url: message.url,
            utmsDefault: shortUtms,
            type: message.type ?? 'whatsapp',
            utmCampaign: defaultUtmCampaign,
            baseUrl: '',
            account: campaignMessage.account,
          })
        : null;

      const bodyParameters = this.buildBodyParameters(message.content, contact, campaignMessage.account);
      const components = this.buildComponents({ shortCode, code: contact.code, bodyParameters });
      try {
        const response = await provider.sendTemplate({
          to: contact.whatsapp,
          templateName: message.providerMessageId!,
          languageCode: language,
          components,
        });
        const wamid = response.messages?.[0]?.id;
        if (wamid) {
          // Persist the wamid→send mapping so delivery webhooks can correlate
          // (msgops-api consumes whatsapp.sent.persist). Best-effort: a publish
          // failure must not abort the send (the message already went out).
          try {
            await this.eventPublisher.publishWhatsappSend({
              wamid,
              accountId,
              channelId,
              contactId: contact.id,
              messageId: message.id,
              campaignId: campaignMessage.campaign?.id,
              templateName: message.providerMessageId,
              toNumber: contact.whatsapp,
              utmCampaign: defaultUtmCampaign,
              sentAt: new Date().toISOString(),
            });
          } catch (pubErr: any) {
            this.logger.warn(`wa_send_persist_publish_failed account=${accountId} contact=${contact.id} err=${pubErr?.message ?? 'unknown'}`);
          }
        }
        return { contactId: contact.id, providerMessageId: wamid };
      } catch (err: any) {
        this.logger.warn(`wa_cloud_send_contact_failed account=${accountId} contact=${contact.id} err=${err?.message ?? 'unknown'}`);
        return { contactId: contact.id, error: err?.message ?? 'send failed' };
      }
    });

    const trackerKey = campaignMessage.message.type === CampaignMessageType.WHATSAPP ? 'SENT_WHATSAPP_BATCH' : 'SENT_SMS_BATCH';
    await this.sendTracker(trackerKey, campaignMessage, sent.length);
    return { status: 201, message: 'ok', sent: sent.length };
  }

  async processAutomation(automationMessage: AutomationMessage) {
    const { contact, message, account } = automationMessage;

    if (!contact?.hasWhatsapp) {
      return await this.invalidContact(contact, automationMessage);
    }
    if (!account?.id) {
      this.logger.error('processAutomation: missing account.id');
      return { status: 400, message: 'missing account.id' };
    }
    if (!message?.providerMessageId) {
      this.logger.error(`processAutomation: message ${message?.id} has no providerMessageId`);
      return { status: 422, message: 'template not synced with Meta' };
    }

    let provider: WhatsappCloudProvider;
    let channelId: number;
    try {
      const built = await this.channelResolver.buildProvider(account.id);
      provider = built.provider;
      channelId = built.channel.id;
    } catch (err: any) {
      this.logger.error(`processAutomation: ${err?.message ?? 'channel resolution failed'}`);
      return { status: 400, message: err?.message ?? 'channel resolution failed' };
    }

    const language = this.configByName(account, 'default_language') || 'pt_BR';
    const domain = this.configByName(account, 'default_domain');
    const shortUtms = `platform=whatsapp_cloud&message_type=${message.type}&type=automation&contactId=${contact.id}&uuid=${contact.uuid}&account=${account.id}&id=${message.name}&message=${message.id}&automation=${automationMessage.automationId}&automationName=${automationMessage.automationName}&automationType=${automationMessage.automationType}&domain=${domain}&utm_content=${automationMessage.utmContent}`;
    const defaultUtmCampaign = `${automationMessage.utmCampaign}`;
    const shortCode = message.url
      ? await this.createRedirectLink({ url: message.url, utmsDefault: shortUtms, type: message.type ?? 'whatsapp', utmCampaign: defaultUtmCampaign, baseUrl: '', account })
      : null;

    const bodyParameters = this.buildBodyParameters(message.content, contact, account);
    const components = this.buildComponents({ shortCode, code: contact.code, bodyParameters });
    try {
      const response = await provider.sendTemplate({
        to: contact.whatsapp!,
        templateName: message.providerMessageId!,
        languageCode: language,
        components,
      });
      const wamid = response.messages?.[0]?.id;
      if (wamid) {
        try {
          await this.eventPublisher.publishWhatsappSend({
            wamid,
            accountId: account.id,
            channelId,
            contactId: contact.id,
            messageId: message.id,
            automationId: automationMessage.automationId,
            templateName: message.providerMessageId,
            toNumber: contact.whatsapp ?? undefined,
            utmCampaign: defaultUtmCampaign,
            sentAt: new Date().toISOString(),
          });
        } catch (pubErr: any) {
          this.logger.warn(`wa_send_persist_publish_failed account=${account.id} contact=${contact.id} err=${pubErr?.message ?? 'unknown'}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`wa_cloud_send_automation_failed account=${account.id} message=${message.id} err=${err?.message ?? 'unknown'}`);
      return { status: 502, message: err?.message ?? 'send failed' };
    }

    if (automationMessage.next?.pubName) {
      await this.eventPublisher.publish(EXCHANGES.triggers, 'trigger.process', automationMessage.next.data);
    }

    return { status: true, message: 'Message published to bms.triggers/trigger.process.' };
  }

  /**
   * Builds the Cloud API `components[]` array. We only need:
   *   - button URL substitution (shortCode → `{{1}}` in the template URL button)
   *   - 2FA-style OTP body parameter (the contact `code`)
   * Templates without parameters just go without `components` at all.
   */
  private buildComponents(opts: { shortCode: string | null; code?: string; bodyParameters?: string[] }): unknown[] | undefined {
    const components: unknown[] = [];
    if (opts.shortCode) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: opts.shortCode }],
      });
    }
    const bodyValues = opts.code ? [opts.code] : (opts.bodyParameters ?? []);
    if (bodyValues.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyValues.map((text) => ({ type: 'text', text })),
      });
    }
    return components.length > 0 ? components : undefined;
  }

  private buildBodyParameters(content: string | undefined, contact: Contact, account: Account): string[] {
    const variables = extractTemplateVariables(extractTemplateBody(content));
    if (variables.length === 0) return [];
    const values = this.utils.mapVariables(contact, account, {}, true);
    return variables.map((name) => sanitizeParameterText(values[name]));
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
