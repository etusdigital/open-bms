import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import { PlatformType } from '../interfaces/push.interfaces';
import { ContactEditableAttributes, EventsType, TwilioEvent } from '../interfaces/events.interfaces';

@Injectable()
export class TwilioService extends EventsService {
  async processTwilioNotification(events: TwilioEvent): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload, categories } = events;
    if (!categories.account || !categories.message || !categories.contactId) {
      this.formatterUtils.logInfo(`Twilio notification missing categories: ${JSON.stringify(events)}`);
      return;
    }

    const type =
      categories.type === 'campaign' ? 'campaign' : categories.type === 'email' ? 'automation' : 'transactional';
    const campaignId = categories.campaign;
    const automationId = categories.automation;

    let geoData = null;
    if (payload.event === 'click') {
      geoData = await this.getGeoIpInfo(payload.ip);
    }

    const timeZone = await this.msgOpsService.getAccountTimeZone(categories.account);
    const pipeline = this.redisClient.pipeline();

    this.updateEventStatistics(pipeline, {
      timestamp: Date.now(),
      accountId: categories.account,
      messageId: categories.message,
      event: payload.event,
      contactId: categories.contactId,
      platform: categories.message_type as PlatformType,
      utmCampaign: categories.utmcampaign,
      type,
      eventId: type === 'campaign' ? Number(campaignId) : Number(automationId) || 0,
      userAgent: payload.headers?.['user-agent'],
      ip: payload.ip,
      ...(payload.event === 'click' && geoData ? { geoData: geoData } : {}),
      timeZone,
    });

    try {
      const changes: ContactEditableAttributes = {};
      const messageType = categories.message_type;
      switch (payload.event) {
        case EventsType.SENT:
          changes[`${messageType}LastSent`] = new Date();
          break;
        case EventsType.DELIVERED:
          changes[`${messageType}LastDelivered`] = new Date();
          break;
        case EventsType.READ:
          changes[`${messageType}LastOpen`] = new Date();
          break;
        case EventsType.CLICK:
          changes[`${messageType}LastClick`] = new Date();
          break;
        default:
          return;
      }

      await this.msgOpsService.updateContactsById([categories.contactId], categories.account, changes);
      await this.saveLogsTwilio(events);

      const results = await pipeline.exec();
      this.handleRedisResults(results);

      return {};
    } catch (error) {
      this.formatterUtils.logInfo(`ERROR TWILIO NOTIFICATION PROCESS: ${error} ${JSON.stringify(events)}`);
      throw new Error('Error processing Twilio notification', { cause: error });
    }
  }

  async saveLogsTwilio(events: TwilioEvent): Promise<void> {
    const { payload, categories } = events;

    if (!['sent', 'delivered', 'read', 'click', 'failed', 'undelivered'].includes(payload.event.toLowerCase())) {
      return;
    }

    const getTwilioErrors: { [key: number]: string } = {
      30001: 'Queue overflow',
      30002: 'Account suspended',
      30003: 'Unreachable destination handset',
      30004: 'Message blocked',
      30005: 'Unknown destination handset',
      30006: 'Landline or unreachable carrier',
      30007: 'Carrier violation',
      30008: 'Unknown error',
      30009: 'Missing segment',
      30010: 'Message price exceeds max price',

      // whatsapp
      63001: 'Channel could not authenticate the request',
      63002: 'Channel could not find From address',
      63003: 'Channel could not find To address',
      63005: 'Channel did not accept given content',
      63006: 'Could not format given content for the channel',
      63007: 'Twilio could not find a Channel with the specified From address',
      63008: 'Could not execute the request because the channel module is misconfigured',
      63009: 'Channel returned an error when executing the request',
      63010: 'Channels - Twilio Internal error',
      63012: 'Channel returned an internal error that prevented it from completing the request',
      63013: "This message send failed because it violates Channel provider's policy.",
      63014: 'This message failed to be delivered to the user because it was blocked by a user action',
    };

    let geoData = null;
    if (payload.event === 'click') {
      geoData = await this.getGeoIpInfo(payload.ip);
    }

    const timeZone = await this.msgOpsService.getAccountTimeZone(categories.account);
    const eventTime = this.formatterUtils.convertTimestampToTimezone(new Date().getTime(), timeZone);
    const values = [
      {
        time: new Date(),
        date: eventTime,
        accountId: categories.account,
        messageType: categories.message_type,
        event: payload.event,
        contactId: categories.contactId || null,
        automationId: categories.automation || null,
        campaignId: categories.campaign || null,
        messageId: categories.message,
        utmCampaign: categories.utmcampaign,
        provider: categories.platform,
        url: this.formatterUtils.removeQueryStringFromUrl(payload.url) || null,
        ip: payload.ip || null,
        reason: getTwilioErrors[payload.ErrorCode] || payload.ErrorCode,
        ...(payload.event === 'click' && geoData ? geoData : {}),
      },
    ];

    await this.sendKafkaMessage(values);
    await this.msgOpsService.saveEventsLogs(values);
  }
}
