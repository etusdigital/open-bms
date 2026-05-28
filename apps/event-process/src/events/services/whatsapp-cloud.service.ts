import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import { PlatformType } from '../interfaces/push.interfaces';
import { EventsType, WhatsappCloudEvent } from '../interfaces/events.interfaces';

/**
 * WhatsApp Cloud delivery + inbound handler. Mirrors TwilioService: it is the
 * single writer of `events_logs_v2` rows with message_type='whatsapp', and it
 * feeds the Redis `event_statistics` counters that the campaign %delivered /
 * %open widgets read.
 *
 * Source events come from msgops-api whatsapp-webhooks via EXCHANGES.events
 * (rk event.received.whatsapp[.inbound]). The producer already did the
 * Postgres writes (send row + contact) and dedup; this service only does the
 * analytics fan-out.
 *
 * Status → EventsType mapping is deliberate:
 *   sent      → SENT
 *   delivered → DELIVERED
 *   read      → OPEN   (the %open widget keys off 'open', NOT 'read')
 *   failed    → BOUNCE
 *   inbound   → INBOUND
 */
@Injectable()
export class WhatsappCloudService extends EventsService {
  private mapEvent(verb: string): EventsType | null {
    switch (verb) {
      case 'sent':
        return EventsType.SENT;
      case 'delivered':
        return EventsType.DELIVERED;
      case 'read':
        return EventsType.OPEN;
      case 'failed':
        return EventsType.BOUNCE;
      case 'inbound':
        return EventsType.INBOUND;
      default:
        return null;
    }
  }

  async processWhatsappCloudEvent(event: WhatsappCloudEvent): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const mapped = this.mapEvent(event.event);
    if (!mapped) {
      this.formatterUtils.logInfo(`WhatsApp Cloud unhandled event verb=${event.event} wamid=${event.wamid}`);
      return;
    }
    if (!event.accountId) {
      this.formatterUtils.logInfo(`WhatsApp Cloud event missing accountId: ${JSON.stringify(event)}`);
      return;
    }

    const type: 'campaign' | 'automation' | 'transactional' = event.campaignId
      ? 'campaign'
      : event.automationId
        ? 'automation'
        : 'transactional';
    const eventId = type === 'campaign' ? Number(event.campaignId) : Number(event.automationId) || 0;
    const timestamp = event.timestamp && Number.isFinite(event.timestamp) ? event.timestamp : Date.now();
    const timeZone = await this.msgOpsService.getAccountTimeZone(event.accountId);

    try {
      // Statistics are keyed on a real contact + correlation. Unknown-wamid
      // events (AC10) carry only accountId — skip the per-campaign counters
      // (eventId/contactId absent) but still write the CH log below.
      if (event.contactId && (event.campaignId || event.automationId)) {
        const pipeline = this.redisClient.pipeline();
        this.updateEventStatistics(pipeline, {
          timestamp,
          accountId: event.accountId,
          messageId: event.messageId,
          event: mapped,
          contactId: event.contactId,
          platform: PlatformType.WHATSAPP,
          utmCampaign: event.utmCampaign,
          type,
          eventId,
          timeZone,
        });
        const results = await pipeline.exec();
        this.handleRedisResults(results);
      }

      await this.saveWhatsappLogs(event, mapped, timeZone);
      return {};
    } catch (error) {
      this.formatterUtils.logInfo(`ERROR WHATSAPP CLOUD PROCESS: ${error} ${JSON.stringify(event)}`);
      throw new Error('Error processing WhatsApp Cloud event', { cause: error });
    }
  }

  private async saveWhatsappLogs(event: WhatsappCloudEvent, mapped: EventsType, timeZone: string): Promise<void> {
    const eventTime = this.formatterUtils.convertTimestampToTimezone(new Date().getTime(), timeZone);
    const values = [
      {
        time: new Date(),
        date: eventTime,
        accountId: event.accountId,
        messageType: 'whatsapp',
        event: mapped,
        contactId: event.contactId ?? null,
        automationId: event.automationId ?? null,
        campaignId: event.campaignId ?? null,
        messageId: event.messageId ?? null,
        utmCampaign: event.utmCampaign,
        provider: PlatformType.WHATSAPP,
        reason: event.errorTitle ?? (event.errorCode !== undefined ? String(event.errorCode) : undefined),
        delivered_id: event.wamid,
        properties: {
          ...(event.properties ?? {}),
          wamid: event.wamid,
        },
      },
    ];

    await this.sendAnalyticsEvent(values);
    await this.msgOpsService.saveEventsLogs(values);
  }
}
