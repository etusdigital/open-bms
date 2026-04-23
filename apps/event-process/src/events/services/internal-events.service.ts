import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import { PlatformType } from '../interfaces/push.interfaces';
import { EventLog, InternalRequest } from '../interfaces/events.interfaces';

const UTM_CAMPAIGN_PATTERN = /^(.+)_e(\d+)_(\d+)$/;
const REDUNDANT_PROPERTY_KEYS = ['bmsu', 'bmsa', 'utm_source', 'utm_medium', 'utm_content', 'utm_campaign'];

@Injectable()
export class InternalEventsService extends EventsService {
  private parseUtmCampaign(utmCampaign: string): { name: string; position: number; messageId: number } | null {
    const match = utmCampaign.match(UTM_CAMPAIGN_PATTERN);
    if (!match) return null;
    const messageId = Number(match[3]);
    if (!messageId) return null;
    return { name: match[1], position: Number(match[2]), messageId };
  }

  async internalEventsProcess(internalEvent: InternalRequest): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload: events } = internalEvent;
    if (!events || !Array.isArray(events)) {
      this.formatterUtils.logInfo(`Invalid internal events: ${JSON.stringify(internalEvent)}`);
      return;
    }

    const timeZones = {};
    const eventsProcess: EventLog[] = [];

    for (const event of events) {
      if (!event.accountId && !event.apiKey) {
        this.formatterUtils.logInfo(`Account id and api key is empty: ${JSON.stringify(event)}`);
        continue;
      }

      if (!event.uuid && !event.contactId) {
        this.formatterUtils.logInfo(`Uuid or email or contactId is empty: ${JSON.stringify(event)}`);
        continue;
      }

      if (event.uuid && event.uuid.length > 40) {
        this.formatterUtils.logInfo(`Invalid uuid: ${JSON.stringify(event)}`);
        continue;
      }

      const accountId = Number(event.accountId) || (await this.msgOpsService.findAccountIdByApiKey(event.apiKey));
      if (!accountId) {
        this.formatterUtils.logInfo(`Account is empty or api key is invalid: ${JSON.stringify(internalEvent)}`);
        continue;
      }

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

      let utmCampaign: string | null = null;
      const utmCampaignRaw = event.properties?.utm_campaign;
      if (utmCampaignRaw) {
        utmCampaign = String(utmCampaignRaw);
        const parsed = this.parseUtmCampaign(utmCampaign);
        if (parsed) {
          if (!event.messageId) {
            event.messageId = parsed.messageId;
          }
          if (!event.campaignId && !event.automationId) {
            const association = await this.msgOpsService.findMessageAssociation(
              accountId,
              parsed.messageId,
              parsed.name,
            );
            if (association?.campaignId) {
              event.campaignId = association.campaignId;
            } else if (association?.automationId) {
              event.automationId = association.automationId;
            }
          }
        }
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
          if (!event.email && contact.email) {
            event.email = contact.email;
          }
        }
      }

      if (event.properties) {
        for (const key of REDUNDANT_PROPERTY_KEYS) {
          delete event.properties[key];
        }
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
        messageType: PlatformType.INTERNALEVENTS,
        properties: event.properties,
        ip: event.ip || null,
        url: event.url || null,
        reason: event.reason || null,
        value: event.properties?.value || null,
        utmCampaign: utmCampaign,
        ...(event.userAgent ? this.userAgentFormatter(event.userAgent) : {}),
        ...(geoData ? geoData : {}),
      });
    }

    if (eventsProcess.length === 0) {
      this.formatterUtils.logInfo(`No internal events to process: ${JSON.stringify(internalEvent)}`);
      return;
    }

    await this.sendKafkaMessage(eventsProcess);
    // TODO: turn on it after create a new postgresql only to backup
    // await this.msgOpsService.saveEventsLogs(eventsProcess);

    return {};
  }
}
