import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import { PlatformType } from '../interfaces/push.interfaces';
import { CustomEventRequest, EventLog } from '../interfaces/events.interfaces';

@Injectable()
export class CustomEventsService extends EventsService {
  async customEventsProcess(customEvent: CustomEventRequest): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload: events } = customEvent;
    if (!events || !Array.isArray(events)) {
      this.formatterUtils.logInfo(`Invalid custom events: ${JSON.stringify(customEvent)}`);
      return;
    }

    const timeZones = {};
    const eventsProcess: EventLog[] = [];
    const pipeline = this.redisClient.pipeline();

    for (const event of events) {
      if (!event.apiKey && !event.accountId) {
        this.formatterUtils.logInfo(`Api key or account id is empty: ${JSON.stringify(event)}`);
        continue;
      }

      if (!event.uuid && !event.email && !event.contactId) {
        this.formatterUtils.logInfo(`Uuid or email or contactId is empty: ${JSON.stringify(event)}`);
        continue;
      }

      if (event.uuid && event.uuid.length > 40) {
        this.formatterUtils.logInfo(`Invalid uuid: ${JSON.stringify(event)}`);
        continue;
      }

      let accountId = event.accountId || (await this.msgOpsService.findAccountIdByApiKey(event.apiKey));
      accountId = Number(accountId);
      if (!accountId) {
        this.formatterUtils.logInfo(`Account is empty: ${JSON.stringify(customEvent)}`);
        continue;
      }

      if (event.properties) {
        event.properties = this.formatterUtils.cleanObject(event.properties);
      }

      const eventObject = await this.msgOpsService.findEvent(event.event, accountId);

      if (eventObject) {
        if (!timeZones[accountId]) {
          const timeZone = await this.msgOpsService.getAccountTimeZone(accountId);
          timeZones[accountId] = timeZone;
        }

        let normalizedTimestamp: number;
        if (event.timestamp) {
          normalizedTimestamp =
            typeof event.timestamp === 'string'
              ? Number(this.formatterUtils.normalizeTimestamp(Number(event.timestamp)))
              : Number(this.formatterUtils.normalizeTimestamp(event.timestamp));
        }

        if (!normalizedTimestamp) {
          normalizedTimestamp = Date.now();
        }

        const timestamp = new Date(Math.min(normalizedTimestamp, Date.now()));

        if (event.url) {
          try {
            const url = new URL(event.url);
            const queryParams = {};
            url.searchParams.forEach((value, key) => {
              queryParams[key] = value;
            });

            event.properties = {
              ...event.properties,
              ...queryParams,
            };

            event.url = `${url.protocol}//${url.hostname}${url.pathname}`;
          } catch (_error) {
            this.formatterUtils.logInfo(`Invalid url: ${JSON.stringify(event)}`);
            continue;
          }
        }

        let geoData = null;
        if (event.ip) {
          geoData = await this.getGeoIpInfo(event.ip);
        }

        if (!event.contactId && event.email && event.email !== '') {
          const contact = await this.msgOpsService.findContactByEmail(accountId, event.email);
          if (contact) {
            event.contactId = contact.id;
          }
        }

        if (!event.contactId && event.uuid && event.uuid !== '') {
          const contact = await this.msgOpsService.findContactByUuid(accountId, event.uuid);
          if (contact) {
            event.contactId = contact.id;
          }
        }

        if (!event.contactId) {
          this.formatterUtils.logInfo(`Contact not found: ${JSON.stringify(event)}`);
          continue;
        }

        eventsProcess.push({
          accountId,
          time: timestamp,
          date: this.formatterUtils.convertTimestampToTimezone(timestamp.getTime(), timeZones[accountId]),
          uuid: event.uuid || null,
          email: event.email || null,
          contactId: event.contactId || null,
          messageId: event.messageId || null,
          automationId: event.automationId || null,
          campaignId: event.campaignId || null,
          event: event.event,
          messageType: PlatformType.CUSTOMEVENTS,
          eventId: eventObject?.id || null,
          properties: event.properties,
          ip: event.ip || null,
          url: event.url || null,
          value: event.properties?.value || null,
          ...(event.userAgent ? this.userAgentFormatter(event.userAgent) : {}),
          ...(geoData ? geoData : {}),
        });

        if (eventObject) {
          this.updateEventStatistics(pipeline, {
            accountId,
            platform: PlatformType.CUSTOMEVENTS,
            event: event.event,
            contactId: event.contactId || null,
            uuid: event.uuid || null,
            eventId: eventObject.id || null,
            timeZone: timeZones[accountId],
            timestamp: timestamp.getTime(),
            ip: event.ip || null,
            userAgent: event.userAgent || null,
            ...(geoData ? { geoData: geoData } : {}),
          });
        }
      }
    }

    if (eventsProcess.length === 0) {
      this.formatterUtils.logInfo(`No custom events to process: ${JSON.stringify(customEvent)}`);
      return;
    }

    await this.eventsTrigger('custom_events', eventsProcess);
    await this.sendAnalyticsEvent(eventsProcess);
    await this.msgOpsService.saveEventsLogs(eventsProcess);

    const results = await pipeline.exec();
    this.handleRedisResults(results);

    return {};
  }
}
