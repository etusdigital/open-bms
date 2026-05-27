import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { TokenMessage } from 'firebase-admin/lib/messaging/messaging-api';
import {
  Account,
  CampaignMessage,
  Contact,
  ContactDevice,
  DefaultParams,
  DeviceType,
  Message,
  SendPushMessage,
} from './interfaces';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from './event-publisher.service';
import { FirebaseProvider } from './providers/firebase.provider';
import { RedisService } from './providers/redis/redis.service';
import { Utils } from './utils/index.utils';
import * as crypto from 'crypto';
import { Redis } from 'ioredis';

@Injectable()
export class AppService implements OnApplicationShutdown {
  private redisClient: Redis;
  private campaignKeys = {};
  onApplicationShutdown(signal: string) {
    console.log(`SHUTDOWN APP ${signal} - ${JSON.stringify(this.campaignKeys)}`);
  }

  constructor(
    private readonly redisService: RedisService,
    private readonly firebaseProvider: FirebaseProvider,
    private readonly eventPublisher: EventPublisherService,
    private readonly utils: Utils
  ) {
    this.redisClient = this.redisService.getClient();
  }

  getHello(): string {
    return 'Hello World!';
  }

  async processSingle(sendPushMessage: SendPushMessage, _redisKeyPayload: string) {
    this.logInfo('sendPushMessage: ', JSON.stringify(sendPushMessage));
    const idempotentProcessingKey = `send-push-message-processing:${sendPushMessage.automationId}:${sendPushMessage.message.id}:${sendPushMessage.contact.id}`;
    if (await this.redisExists(idempotentProcessingKey)) {
      console.error('[Single] Message being processed', idempotentProcessingKey);
      return;
    }

    const idempotentKey = `send-push-message-processed:${sendPushMessage.automationId}:${sendPushMessage.message.id}:${sendPushMessage.contact.id}`;
    if (await this.redisExists(idempotentKey)) {
      console.error('[Single] Message already processed', idempotentKey);
      return;
    }

    this.setRedis(idempotentProcessingKey, 'true', 60);

    sendPushMessage.contact.contactDevices = (sendPushMessage.contact.contactDevices || []).filter(
      (device) => device.type == (sendPushMessage.message.type as unknown as DeviceType)
    );

    if (!sendPushMessage.contact.contactDevices.length) {
      this.logInfo('User without active devices', JSON.stringify(sendPushMessage));
      if (sendPushMessage.next && sendPushMessage.next?.pubName) {
        await this.eventPublisher.publish(EXCHANGES.triggers, 'trigger.process', sendPushMessage.next.data);
      }

      await this.redisClient.del(idempotentProcessingKey);
      await this.setRedis(idempotentKey, 'true', 180);

      return {
        status: true,
        message: `[PUSH-ERROR] ${sendPushMessage.contact.id} - ${sendPushMessage.contact.email} - User without active devices`,
      };
    }

    const { account, contact, message } = sendPushMessage;
    const language = this.getAccountConfig(account.accountConfigs, 'language') || 'pt-BR';
    const timeZone = this.getAccountConfig(account.accountConfigs, 'time_zone') || 'America/Sao_Paulo';
    const messageParse = this.utils.parseVariables(message.url, contact, account, language, timeZone);
    const messageUrl = this.addDefaultUTMs(messageParse, account, sendPushMessage.utmCampaign, message.type);

    if (!contact.uuid) {
      this.logInfo('empty uuid', JSON.stringify(contact));
    }

    const firebaseMessages = contact.contactDevices.map((device: ContactDevice): TokenMessage => {
      const customData = {
        contactId: `${contact.id}`,
        contact_id: `${contact.id}`,
        uuid: `${contact.uuid}`,
        device_id: `${device.id}`,
        account: `${account.id}`,
        account_id: `${account.id}`,
        message: `${message.id}`,
        message_id: `${message.id}`,
        automation: `${sendPushMessage.automationId}`,
        automation_id: `${sendPushMessage.automationId}`,
        automationType: sendPushMessage.automationType,
        domain: this.utils.getDomainFromUrl(messageUrl),
        url: messageUrl,
        utm_campaign: sendPushMessage.utmCampaign,
        utm_content: sendPushMessage.utmContent,
      };
      return this.formattedPayload(
        device,
        message,
        contact,
        account,
        customData,
        messageUrl,
        sendPushMessage.utmCampaign,
        language,
        timeZone
      );
    });

    try {
      const firebaseService = this.definedFirebaseService(account, message.type);
      await this.firebaseProvider.sendFirebaseMessages(
        firebaseMessages,
        firebaseService.service,
        firebaseService.firebaseApp
      );

      await this.processSent(firebaseMessages, message.type);

      if (sendPushMessage.next && sendPushMessage.next?.pubName) {
        await this.eventPublisher.publish(EXCHANGES.triggers, 'trigger.process', sendPushMessage.next.data);
      }

      await this.redisClient.del(idempotentProcessingKey);
      await this.setRedis(idempotentKey, 'true', 180);

      return { status: true, message: `message sent to bms.triggers/trigger.process.` };
    } catch (error) {
      await this.redisClient.del(idempotentProcessingKey);
      throw new Error(
        `[${sendPushMessage.messageId}] Error to send message to ${sendPushMessage.next.pubName} error: ${error}`
      );
    }
  }

  async process(campaignMessage: CampaignMessage, redisKeyPayload: string) {
    const idempotentProcessingKey = `send-push-campaign-page-processing:${campaignMessage.campaign.id}:${campaignMessage.page}`;
    if (await this.redisExists(idempotentProcessingKey)) {
      console.error('[Campaign] Page being processed', idempotentProcessingKey);
      return;
    }

    const idempotentKey = `send-push-campaign-page-processed:${campaignMessage.campaign.id}:${campaignMessage.page}`;
    if (await this.redisExists(idempotentKey)) {
      console.error('[Campaign] Page already processed', idempotentKey);
      return;
    }

    this.setRedis(idempotentProcessingKey, 'true', 60);

    try {
      this.campaignKeys[redisKeyPayload] = campaignMessage;
      const { account, campaign, message } = campaignMessage;
      let defaultDomain: URL;
      const accountDomain = this.getAccountConfig(account.accountConfigs, 'default_domain');
      const language = this.getAccountConfig(account.accountConfigs, 'language') || 'pt-BR';
      const timeZone = this.getAccountConfig(account.accountConfigs, 'time_zone') || 'America/Sao_Paulo';
      if (accountDomain) {
        defaultDomain = new URL(accountDomain);
      }

      const firebaseMessages: TokenMessage[] = campaignMessage.contacts.flatMap((contact: Contact): TokenMessage[] => {
        const messageUrl = this.utils.parseVariables(message.url, contact, account, language, timeZone);

        return contact.contactDevices.map((device: ContactDevice): TokenMessage => {
          if (!contact.uuid) {
            this.logInfo('empty uuid', JSON.stringify(contact));
          }
          const customData = {
            contactId: `${contact.id}`,
            contact_id: `${contact.id}`,
            uuid: `${contact.uuid}`,
            device_id: `${device.id}`,
            account: `${account.id}`,
            account_id: `${account.id}`,
            message: `${message.id}`,
            message_id: `${message.id}`,
            campaign_type: campaign.type,
            campaign: `${campaign.id}`,
            campaign_id: `${campaign.id}`,
            domain: this.utils.getDomainFromUrl(messageUrl || defaultDomain.href),
            url: this.addDefaultUTMs(messageUrl, account, `${campaign.name}_e1_${message.id}`, message.type),
            utm_campaign: `${campaign.name}_e1_${message.id}`,
          };
          return this.formattedPayload(
            device,
            message,
            contact,
            account,
            customData,
            messageUrl,
            `${campaign.name}_e1_${message.id}`,
            language,
            timeZone
          );
        });
      });

      this.logInfo(
        `Campaign: ${campaignMessage.campaign_id} - Contacts: ${campaignMessage.contacts.length} - firebaseMessages: ${firebaseMessages.length}`
      );

      const firebaseService = this.definedFirebaseService(account, message.type);
      await this.firebaseProvider.sendFirebaseMessages(
        firebaseMessages,
        firebaseService.service,
        firebaseService.firebaseApp
      );

      await this.processSent(firebaseMessages, message.type);
      await this.sendTracker('SENT_PUSH_BATCH', campaignMessage, firebaseMessages.length);

      await this.redisClient.del(idempotentProcessingKey);
      await this.setRedis(idempotentKey, 'true', 180);
      delete this.campaignKeys[redisKeyPayload];
      return { status: 201, message: 'ok' };
    } catch (error) {
      await this.redisClient.del(idempotentProcessingKey);

      throw new Error(`[Campaign] Error to process campaign ${campaignMessage.campaign_id}: ${error}`);
    }
  }

  definedFirebaseService(account: Account, messageType: string) {
    if (messageType === 'mobile-push') {
      const firebaseService = this.getAccountConfig(account.accountConfigs, 'firebase_service_account_app');
      if (firebaseService) return { service: firebaseService, firebaseApp: `mobile-push-account-${account.id}` };
    }
    return { service: process.env.FIREBASE_SERVICE_ACCOUNT, firebaseApp: 'default' };
  }

  formattedPayload(
    device: ContactDevice,
    message: Message,
    contact: Contact,
    account: Account,
    customData: { [key: string]: string },
    messageUrl: string,
    utmCampaign: string,
    language: string,
    timeZone: string
  ) {
    const titleFomatted = this.utils.parseContent(message.subject, contact, account, language, timeZone);
    const bodyFormatted = this.utils.parseContent(message.content, contact, account, language, timeZone);
    return {
      token: device.token,
      notification: {
        title: titleFomatted,
        body: bodyFormatted,
      },
      fcmOptions: {
        analyticsLabel: `account_${account.id}`,
      },
      data: customData,
      webpush: {
        ...(message.expiryPushInSeconds
          ? {
              headers: {
                TTL: message.expiryPushInSeconds.toString(),
              },
            }
          : null),
        notification: {
          title: titleFomatted,
          body: bodyFormatted,
          icon: message.image ?? '',
          requireInteraction: message.requireInteraction ?? true,
        },
        fcmOptions: {
          link: this.addDefaultUTMs(messageUrl, account, utmCampaign),
        },
      },
      apns: {
        ...(message.expiryPushInSeconds
          ? { headers: { 'apns-expiration': `${Math.floor(Date.now() / 1000) + message.expiryPushInSeconds}` } }
          : {}),
        payload: {
          aps: {
            alert: {
              title: titleFomatted,
              body: bodyFormatted,
              launchImage: message.image ?? '',
            },
            category: JSON.stringify(customData),
          },
        },
      },
      android: {
        ...(message.expiryPushInSeconds ? { ttl: message.expiryPushInSeconds } : {}),
        notification: {
          title: titleFomatted,
          body: bodyFormatted,
          icon: message.image ?? '',
          sound: message.sound,
        },
      },
    };
  }

  async processSent(messages: TokenMessage[], messageType: string): Promise<void> {
    const timestamp = new Date().getTime();
    const sentPayload = messages.map((message) => {
      const eventId = crypto.randomUUID();
      return {
        ...message.data,
        timestamp,
        messageType,
        event: 'sent',
        eventID: eventId,
        event_id: eventId,

        event_name: 'sent',
        event_type: 'web-push',
      };
    });

    if (sentPayload.length) {
      this.logInfo(`sentPayload: ${sentPayload.length}`, JSON.stringify(sentPayload));
      // messageType ∈ {web-push, mobile-push} colapsa em routing-key 'push'
      // (Onda 1 §2.1, queue event-process.event.received.push).
      await this.eventPublisher.publish(
        EXCHANGES.events,
        'event.received.push',
        { payload: sentPayload },
        {
          platform: 'push',
          message_type: messageType,
          timestamp: timestamp.toString(),
          events: 'sent',
        }
      );
    }
  }

  addDefaultUTMs(messageUrl: string, account: Account, utmCampaign?: string, messageType?: string): string {
    const defaultParams: DefaultParams = {
      utm_source: messageType == 'mobile-push' ? 'app-push' : 'push',
      utm_medium: messageType == 'mobile-push' ? 'app' : 'web',
      utm_campaign: utmCampaign,
    };

    const accountDomain = this.getAccountConfig(account.accountConfigs, 'default_domain');

    if (!messageUrl && !accountDomain) {
      console.warn(`[AppService] Account ${account.id} has no default_domain`);
      return '';
    }

    const url = new URL(messageUrl || accountDomain);
    const params = new URLSearchParams(url.search);
    const paramsFromUrl = {};

    for (const key of params.keys()) {
      if (params.getAll(key).length > 1) {
        paramsFromUrl[key] = params.getAll(key);
      } else {
        paramsFromUrl[key] = params.get(key);
      }
    }

    const queryString = this.utils.createQueryParams({
      ...defaultParams,
      ...paramsFromUrl,
    });

    const finalUrl = `${url.origin}${url.pathname}?${queryString}`;
    return finalUrl;
  }

  async sendTracker(event: string, campaignMessage: CampaignMessage, totalSent: number, data?: any) {
    const tracker = {
      campaign_id: campaignMessage.campaign_id,
      service: 'MSGOPS_SEND_BATCH_PUSH',
      event: event,
      timestamp: new Date().getTime(),
      audiences: [],
      contacts_length: totalSent,
      packages_length: null,
      package_id: null,
      email_id: campaignMessage.message.id,
      email_subject: campaignMessage.message.subject,
      page: campaignMessage.page,
      totalPages: campaignMessage.totalPages,
      data: data,
      testabMode: campaignMessage.campaign_test_ab_mode,
    };

    await this.eventPublisher.publish(EXCHANGES.campaigns, 'campaign.tracked', tracker);
    return { status: true, message: 'tracker published to bms.campaigns/campaign.tracked' };
  }

  logInfo(dsc: string, args?: string) {
    const logLevel = process.env.LOG_LEVEL || 'INFO';
    if (logLevel === 'INFO' || logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }

  getAccountConfig(accountConfigs, key) {
    if (!accountConfigs) return undefined;

    if (Array.isArray(accountConfigs)) {
      const { value } = accountConfigs.find((config) => config.name === key) || {};
      return value;
    }

    return accountConfigs[key];
  }

  async redisExists(redisKey: string): Promise<number> {
    return await this.redisClient.exists(redisKey);
  }

  async getDelRedis(redisKey: string): Promise<object> {
    const payload = await this.redisClient.getdel(redisKey);
    return JSON.parse(payload);
  }

  async setRedis(redisKey: string, payload: object | string, expiration: number) {
    if (expiration) {
      return await this.redisClient.set(redisKey, JSON.stringify(payload), 'EX', expiration);
    }
    return await this.redisClient.set(redisKey, JSON.stringify(payload));
  }
}
