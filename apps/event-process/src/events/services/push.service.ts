import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import { PlatformType, PushPayload, PushWebhook } from '../interfaces/push.interfaces';
import { ContactDeviceEditableAttributes, EventsType } from '../interfaces/events.interfaces';
import { QueryResult } from 'pg';

@Injectable()
export class PushService extends EventsService {
  async processPush(events: PushWebhook): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload } = events;

    if (!payload) {
      return;
    }

    const pushEvents = Array.isArray(payload) ? payload : [payload];
    const pipeline = this.redisClient.pipeline();

    await Promise.all(
      pushEvents.map(async (event) => {
        if (event.account && event.message && event.contactId) {
          const timeZone = await this.msgOpsService.getAccountTimeZone(event.account);
          const type = event.campaign ? 'campaign' : event.automationType === 'email' ? 'automation' : 'transactional';
          const automationId = event.automation;
          const campaignId = event.campaign;
          let geoData = null;

          if (event.event === 'click') {
            geoData = await this.getGeoIpInfo(events.client_info.EVENT_IP);
          }

          this.updateEventStatistics(pipeline, {
            type,
            accountId: event.account,
            messageId: event.message,
            event: event.event,
            contactId: event.contactId,
            platform: (events.platform as PlatformType) || (event.messageType as PlatformType),
            utmCampaign: event.utm_campaign,
            eventId: type === 'campaign' ? Number(campaignId) : Number(automationId) || 0,
            ...(event.event === 'click' && {
              userAgent: events.client_info.EVENT_FAMILY,
              ip: events.client_info.EVENT_IP,
            }),
            ...(geoData ? { geoData: geoData } : {}),
            timeZone,
            timestamp: event.timestamp,
          });
        }
      }),
    );

    const groupedEvents = this.groupEventsPush(pushEvents);
    await Promise.all(
      Object.keys(groupedEvents).map(async (key) => {
        await this.processEventsPush(key, groupedEvents[key], groupedEvents[key][0].account);
      }),
    );

    await this.saveLogsPush(events);

    const results = await pipeline.exec();
    this.handleRedisResults(results);

    return {};
  }

  async processEventsPush(eventType: string, payload: PushPayload[], accountId: number): Promise<QueryResult> {
    if (!payload.length) {
      return;
    }

    if (!accountId) {
      this.formatterUtils.logInfo(`Push empty accountId: ${JSON.stringify(payload)}`);
      return;
    }

    const ids = payload.map((event) => event.device_id);
    const averageTimestamp = payload[0].timestamp;
    const timeZone = await this.msgOpsService.getAccountTimeZone(accountId);

    const changes: ContactDeviceEditableAttributes = {};
    switch (eventType) {
      case EventsType.DELIVERED:
        changes.lastDelivered = new Date(averageTimestamp);
        changes.lastDeliveredDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        changes.isActive = true;
        break;
      case EventsType.SENT:
        changes.lastSent = new Date(averageTimestamp);
        changes.lastSentDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        break;
      case EventsType.CLICK:
        changes.lastClick = new Date(averageTimestamp);
        changes.lastClickDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        changes.isActive = true;
        break;
      case EventsType.BOUNCE:
        changes.isActive = false;
        break;
      default:
        return;
    }

    return this.msgOpsService.updateContactDevices(ids, accountId, changes);
  }

  groupEventsPush(payload: PushPayload[]): Record<string, PushPayload[]> {
    const eventsTypes: Record<string, PushPayload[]> = {};
    payload.forEach((eventPush) => {
      if (!eventPush.account || !eventPush.message || !eventPush.contactId) return;

      if (!eventsTypes.hasOwnProperty(eventPush.event)) {
        eventsTypes[eventPush.event] = [];
      }
      eventsTypes[eventPush.event].push(eventPush);
    });

    return eventsTypes;
  }

  async saveLogsPush(events: PushWebhook): Promise<void> {
    const { payload, client_info } = events;
    const pushEvents = Array.isArray(payload) ? payload : [payload];

    if (!pushEvents.length) {
      return;
    }

    if (!pushEvents[0].account || !pushEvents[0].message || !pushEvents[0].contactId) {
      this.formatterUtils.logInfo(`Push empty accountId: ${JSON.stringify(events)}`);
      return;
    }

    const timeZone = await this.msgOpsService.getAccountTimeZone(pushEvents[0].account);

    const values = await Promise.all(
      pushEvents.map(async (item) => {
        let geoData = null;
        if (['delivered', 'click'].includes(item.event) && client_info?.EVENT_IP) {
          geoData = await this.getGeoIpInfo(client_info.EVENT_IP);
        }

        return {
          time: new Date(Math.min(item.timestamp, Date.now())),
          date: this.formatterUtils.convertTimestampToTimezone(item.timestamp, timeZone),
          accountId: item.account,
          messageType: item.messageType || events.platform,
          event: item.event,
          contactId: item.contactId || null,
          automationId: item.automation || null,
          campaignId: item.campaign || null,
          messageId: item.message,
          utmCampaign: item.utm_campaign,
          url: this.formatterUtils.removeQueryStringFromUrl(item.url) || null,
          ip: client_info?.EVENT_IP || null,
          userAgent: client_info?.EVENT_FAMILY || null,
          ...(['delivered', 'click'].includes(item.event) && geoData ? geoData : {}),
          ...(['delivered', 'click'].includes(item.event) && client_info.EVENT_FAMILY !== ''
            ? this.userAgentFormatter(client_info.EVENT_FAMILY)
            : {}),
        };
      }),
    );

    await this.sendKafkaMessage(values);
    await this.msgOpsService.saveEventsLogs(values);
  }
}
