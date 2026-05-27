import { Injectable } from '@nestjs/common';
import { ChainableCommander } from 'ioredis';
import { QueryResult } from 'pg';
import { EventsService } from './events.service';
import { PlatformType } from '../interfaces/push.interfaces';
import {
  AutomationTargetEvent,
  ContactEditableAttributes,
  ContactValidateEditableAttributes,
  EventLog,
  EventsType,
  InternalEvent,
  ProcessedGroup,
  ResendEvent,
  ResendEventTypes,
  ResendPayload,
  ResendRawEvent,
  TestAbEvent,
} from '../interfaces/events.interfaces';

@Injectable()
export class ResendService extends EventsService {
  async processResend(events: ResendEvent): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload, account: providerAccount } = events;
    const raws = Array.isArray(payload) ? payload : [payload];
    const normalized = this.normalizeEvents(raws);

    if (normalized.length === 0) {
      this.formatterUtils.logInfo(`[Resend] No processable events in payload`);
      return { status: 'skipped', message: 'No processable events' };
    }

    const uniqueEvents = await this.filterDuplicateEvents(normalized);
    if (uniqueEvents.length === 0) {
      this.formatterUtils.logInfo(`[Resend] All events were duplicates`);
      return { status: 'skipped', message: 'All events were duplicates' };
    }

    const pipeline = this.redisClient.pipeline();
    const { processedGroups, eventLogs, testAbEvents, automationTargetEvents, leadActivationEvents } =
      await this.organizeEventsData(uniqueEvents, providerAccount, pipeline);

    if (testAbEvents.length > 0) await this.processTestAbEvent(testAbEvents);
    if (automationTargetEvents.length > 0) await this.processAutomationTargetEvents(automationTargetEvents);
    if (leadActivationEvents.length) await this.processActivationEvents(leadActivationEvents);

    await Promise.all([this.processAllEvents(processedGroups), this.saveLogs(eventLogs)]);

    const results = await pipeline.exec();
    this.handleRedisResults(results);
    return {};
  }

  // Resend ships tags as `[{name, value}]`. We re-encode them into the
  // SendGrid-style `category` array (`<name>:<value>`) so parseEventType
  // matches the rest of the pipeline.
  private normalizeEvents(raws: ResendRawEvent[]): ResendPayload[] {
    const out: ResendPayload[] = [];
    for (const raw of raws || []) {
      const mapped = this.mapEventType(raw.type);
      if (!mapped) {
        this.formatterUtils.logInfo(`[Resend] Skipping unsupported event type: ${raw.type}`);
        continue;
      }
      const data = raw.data || {};
      const tags = (data.tags || []) as { name: string; value: string }[];
      const category = tags.map((t) => `${t.name}:${t.value}`);
      const contactIdTag = tags.find((t) => t.name === 'contactId');
      const contactId = contactIdTag?.value;

      const click = (data.click || {}) as Record<string, any>;
      const open = (data.open || {}) as Record<string, any>;
      const ip = click.ipAddress || open.ipAddress;
      const useragent = click.userAgent || open.userAgent;
      const url = click.link;

      // Resend categorizes bounce subtypes via `data.bounce.type`. The
      // top-level event is always `email.bounced`; HARD/SOFT split is on
      // the subtype (Permanent → HARD, Transient/Undetermined → SOFT).
      let synthType: string | undefined;
      let bounceClassification: string | undefined;
      if (raw.type === ResendEventTypes.BOUNCED) {
        const subtype = (data.bounce?.type || '').toLowerCase();
        if (subtype === 'permanent') synthType = 'bounce';
        else synthType = 'blocked';
        bounceClassification = data.bounce?.type || data.bounce?.subType;
      }

      out.push({
        email: data.to?.[0] || '',
        timestamp: this.parseTimestamp(raw.created_at ?? data.created_at),
        event: mapped,
        resendType: raw.type,
        category,
        re_event_id: data.email_id ? `${data.email_id}:${raw.type}:${raw.created_at ?? ''}` : '',
        re_message_id: data.email_id || '',
        reason: data.bounce?.message || data.complaint?.feedback_type,
        ip,
        useragent,
        url,
        contactId,
        messageId: this.formatterUtils.parseEventType(category, 'message') || undefined,
        bounce_classification: bounceClassification,
        type: synthType,
        properties: undefined,
      });
    }
    return out;
  }

  private parseTimestamp(ts: number | string | undefined): number {
    if (ts === undefined || ts === null || ts === '') return 0;
    const n = typeof ts === 'number' ? ts : Number(ts);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(String(ts));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  }

  private mapEventType(type: string): string | null {
    switch (type) {
      case ResendEventTypes.SENT:
        return EventsType.PROCESSED;
      case ResendEventTypes.DELIVERED:
        return EventsType.DELIVERED;
      case ResendEventTypes.DELIVERY_DELAYED:
        return EventsType.DEFERRED;
      case ResendEventTypes.BOUNCED:
      case ResendEventTypes.FAILED:
        return EventsType.BOUNCE;
      case ResendEventTypes.COMPLAINED:
        return EventsType.SPAMREPORT;
      case ResendEventTypes.OPENED:
        return EventsType.OPEN;
      case ResendEventTypes.CLICKED:
        return EventsType.CLICK;
      default:
        return null;
    }
  }

  private async organizeEventsData(
    events: ResendPayload[],
    providerAccount: string | undefined,
    pipeline: ChainableCommander,
  ): Promise<{
    processedGroups: ProcessedGroup[];
    eventLogs: EventLog[][];
    testAbEvents: TestAbEvent[];
    automationTargetEvents: AutomationTargetEvent[];
    leadActivationEvents: InternalEvent[];
  }> {
    const eventsToProcess = new Set(Object.values(EventsType));
    const testAbEvents: TestAbEvent[] = [];
    const automationTargetEvents: AutomationTargetEvent[] = [];
    const accountGroups: Record<
      string,
      {
        accountId: number;
        timeZone: string;
        events: { type: string; eventList: ResendPayload[] }[];
        eventMap: Map<string, { type: string; eventList: ResendPayload[] }>;
        logs: EventLog[];
      }
    > = {};

    const accountIds = new Set<string>();
    events.forEach((e) => {
      const id = this.formatterUtils.parseEventType(e.category, 'account');
      if (id) accountIds.add(id);
    });
    const timeZones = await this.prefetchTimeZones(Array.from(accountIds).map(Number));
    const leadActivationEvents: InternalEvent[] = [];

    for (const event of events) {
      const messageId = this.formatterUtils.parseEventType(event.category, 'message');
      const accountId = this.formatterUtils.parseEventType(event.category, 'account');

      if (!messageId || !accountId) {
        this.formatterUtils.logInfo(`[Event-Process] Missing resend context: ${JSON.stringify(event)}`);
        continue;
      }
      if (!accountGroups[accountId]) {
        accountGroups[accountId] = {
          accountId: Number(accountId),
          timeZone: timeZones[Number(accountId)],
          events: [],
          eventMap: new Map(),
          logs: [],
        };
      }
      if (!eventsToProcess.has(event.event as EventsType)) continue;

      if (['open', 'click'].includes(event.event) && event.contactId) {
        const contactId = Number(event.contactId);
        const contact = await this.msgOpsService.findContactById(Number(accountId), contactId);
        if (contact) {
          event.properties = { previousOpen: contact.last_open || 'null', previousClick: contact.last_click || 'null' };
        }
        if (
          contact &&
          (contact.last_open === null || contact.last_open < new Date(Date.now() - 1000 * 60 * 60 * 24 * 30))
        ) {
          leadActivationEvents.push({
            accountId,
            timestamp: event.timestamp,
            contactId,
            uuid: contact.uuid,
            email: contact.email,
            event: 'activated',
            automationId: Number(this.formatterUtils.parseEventType(event.category, 'automation-id')) || null,
            campaignId: Number(this.formatterUtils.parseEventType(event.category, 'campaign')) || null,
            messageId: Number(messageId) || null,
            ip: contact.ip,
            properties: {},
          });
        }
      }

      if (['open', 'click'].includes(event.event) && event.ip) {
        const geoData = await this.getGeoIpInfo(event.ip);
        if (geoData.country || geoData.traits) event.geoData = geoData;
        const automation = this.formatterUtils.parseEventType(event.category, 'automation-id');
        if (automation) {
          const targetKey = `automation_target:${Number(accountId)}:${Number(automation)}:${event.event}`;
          if (await this.redisClient.exists(targetKey)) {
            automationTargetEvents.push({
              automationId: Number(automation),
              accountId: Number(accountId),
              contactId: Number(event.contactId),
            });
          }
        }
      }

      if (event.category && this.formatterUtils.parseEventType(event.category, 'testab-message')) {
        const campaignId = this.formatterUtils.parseEventType(event.category, 'campaign');
        testAbEvents.push({ campaignId, messageId, eventType: event.event });
      }

      if (event.event !== EventsType.PROCESSED) {
        const eventGroup = accountGroups[accountId].eventMap.get(event.event);
        if (eventGroup) {
          eventGroup.eventList.push(event);
        } else {
          const newGroup = { type: event.event, eventList: [event] };
          accountGroups[accountId].eventMap.set(event.event, newGroup);
          accountGroups[accountId].events.push(newGroup);
        }
      }

      if (event.event !== EventsType.PROCESSED) {
        const eventLog: EventLog = {
          time: new Date(event.timestamp * 1000),
          date: this.formatterUtils.convertTimestampToTimezone(event.timestamp, accountGroups[accountId].timeZone),
          accountId: Number(accountId),
          messageType: 'email',
          event: this.formatterUtils.normalizeEvents(event.event),
          email: event.email,
          contactId: event.contactId === 'undefined' ? null : Number(event.contactId) || null,
          automationId: Number(this.formatterUtils.parseEventType(event.category, 'automation-id')) || null,
          campaignId: Number(this.formatterUtils.parseEventType(event.category, 'campaign')) || null,
          messageId: Number(messageId) || null,
          utmCampaign: this.formatterUtils.parseEventType(event.category, 'utmcampaign') || null,
          provider: 'resend',
          provider_account: providerAccount || null,
          isTestAb: this.formatterUtils.parseEventType(event.category, 'testab-message') ? true : false,
          reason: event.reason || null,
          url: event.url ? this.formatterUtils.removeQueryStringFromUrl(event.url) || null : null,
          pool: this.formatterUtils.parseEventType(event.category, 'pool') || null,
          ...(['delivered', 'open', 'click'].includes(event.event) && event.ip && event.ip !== 'unknown'
            ? { ip: event.ip }
            : {}),
          ...(['open', 'click'].includes(event.event) && event.useragent
            ? this.userAgentFormatter(event.useragent)
            : {}),
          ...(event.geoData || {}),
          properties: {
            ...(event?.properties || {}),
            ...([EventsType.BOUNCE, EventsType.BLOCKED].includes(event.event as EventsType)
              ? {
                  bounce_classification: event.bounce_classification || null,
                  bounce_type: event.type === 'blocked' ? 'SOFT' : 'HARD',
                  resend_type: event.resendType,
                }
              : {}),
          },
          delivered_id: event.re_message_id || '',
        };
        accountGroups[accountId].logs.push(eventLog);
      }

      const eventType = this.formatterUtils.parseEventType(event.category, 'type');
      const campaignId = this.formatterUtils.parseEventType(event.category, 'campaign');
      const automationId = this.formatterUtils.parseEventType(event.category, 'automation-id');

      this.updateEventStatistics(pipeline, {
        timeZone: accountGroups[accountId].timeZone,
        accountId: Number(accountId),
        messageId: Number(messageId),
        event: event.event,
        contactId: Number(event.contactId),
        platform: PlatformType.EMAIL,
        type: eventType === 'email' ? 'automation' : eventType === 'campaign' ? 'campaign' : 'transactional',
        eventId: eventType === 'campaign' && Number(campaignId) ? Number(campaignId) : Number(automationId) || 0,
        pool: this.formatterUtils.parseEventType(event.category, 'pool'),
        utmCampaign: this.formatterUtils.parseEventType(event.category, 'utmcampaign'),
        providerAccount: providerAccount,
        userAgent: event.useragent,
        ip: event.ip,
        emailProvider: this.formatterUtils.getMailBoxProvider(event.email),
        isTestAb: this.formatterUtils.parseEventType(event.category, 'testab-message') ? true : false,
        timestamp: event.timestamp,
        email: event.email,
        ...(event.geoData ? { geoData: event.geoData } : {}),
      });
    }

    const processedGroups: ProcessedGroup[] = Object.values(accountGroups).map((group) => ({
      accountId: group.accountId,
      timeZone: group.timeZone,
      events: group.events as any,
    }));
    const eventLogs: EventLog[][] = Object.values(accountGroups).map((g) => g.logs);
    return { processedGroups, eventLogs, testAbEvents, automationTargetEvents, leadActivationEvents };
  }

  private async saveLogs(eventLogs: EventLog[][]): Promise<void> {
    await Promise.all(
      eventLogs.map(async (logs) => {
        await this.sendAnalyticsEvent(logs);
        await this.msgOpsService.saveEventsLogs(logs);
      }),
    );
  }

  private async processAllEvents(groups: ProcessedGroup[]): Promise<void> {
    await Promise.all(
      groups.flatMap(({ accountId, timeZone, events }) =>
        events.map(async ({ type, eventList }) => {
          if (type === 'open' || type === 'click') await this.eventsTrigger(type, eventList as any, accountId);
          await this.updateContact(type, accountId, timeZone, eventList as any);
        }),
      ),
    );
  }

  private async updateContact(
    type: string,
    accountId: number,
    timeZone: string,
    events: ResendPayload[],
  ): Promise<QueryResult> {
    const ids = [
      ...new Set(events.filter((e) => e.contactId && !isNaN(Number(e.contactId))).map((e) => Number(e.contactId))),
    ];
    const emails = [...new Set(events.map((e) => e.email))];
    const ts = events[0].timestamp * 1000;
    const changes: ContactEditableAttributes = {};
    const changesValidate: ContactValidateEditableAttributes = {};

    switch (type) {
      case EventsType.DELIVERED:
        changes.lastSent = new Date(ts);
        changes.lastSentDate = this.formatterUtils.convertTimestampToTimezone(ts, timeZone);
        break;
      case EventsType.OPEN:
        changes.lastOpen = new Date(ts);
        changes.lastOpenDate = this.formatterUtils.convertTimestampToTimezone(ts, timeZone);
        changesValidate.lastOpen = new Date(ts);
        changes.isActive = true;
        break;
      case EventsType.CLICK:
        changes.lastOpen = new Date(ts);
        changes.lastOpenDate = this.formatterUtils.convertTimestampToTimezone(ts, timeZone);
        changes.lastClick = new Date(ts);
        changes.lastClickDate = this.formatterUtils.convertTimestampToTimezone(ts, timeZone);
        changesValidate.lastClick = new Date(ts);
        changes.isActive = true;
        break;
      case EventsType.UNSUBSCRIBE:
      case EventsType.SPAMREPORT:
        changes.isUnsubscribed = true;
        changes.unsubscribedAt = new Date(ts);
        changesValidate.unsubscribedAt = new Date(ts);
        await this.createRedisKey(`${accountId}:unsubscribed`, emails, 168);
        break;
      case EventsType.BOUNCE:
        await this.updateBouncedContacts(accountId, events);
        return;
      default:
        return;
    }

    if (ids.length) await this.msgOpsService.updateContactsById(ids, accountId, changes);
    if (emails.length && Object.keys(changesValidate).length) {
      await this.msgOpsService.updateContactsValidateByEmail(emails, changesValidate);
    }
    return;
  }

  private async updateBouncedContacts(accountId: number, events: ResendPayload[]): Promise<void> {
    const hard = events.filter((e) => e.type !== 'blocked');
    const soft = events.filter((e) => e.type === 'blocked');
    const hardIds = new Set(
      hard.filter((e) => e.contactId && !isNaN(Number(e.contactId))).map((e) => Number(e.contactId)),
    );
    const softFiltered = soft.filter(
      (e) => !e.contactId || isNaN(Number(e.contactId)) || !hardIds.has(Number(e.contactId)),
    );

    if (hard.length) await this.persistBounce(accountId, hard, 'HARD');
    if (softFiltered.length) await this.persistBounce(accountId, softFiltered, 'SOFT');
  }

  private async persistBounce(accountId: number, events: ResendPayload[], bounceType: 'HARD' | 'SOFT'): Promise<void> {
    const contactMap = new Map<number, Date>();
    const emailMap = new Map<string, Date>();
    for (const e of events) {
      const ts = new Date(e.timestamp * 1000);
      const id = e.contactId && !isNaN(Number(e.contactId)) ? Number(e.contactId) : null;
      if (id !== null) {
        const existing = contactMap.get(id);
        if (!existing || ts > existing) contactMap.set(id, ts);
      }
      const existingEmail = emailMap.get(e.email);
      if (!existingEmail || ts > existingEmail) emailMap.set(e.email, ts);
    }
    const contactEntries = Array.from(contactMap.entries()).map(([id, bouncedAt]) => ({ id, bounceType, bouncedAt }));
    const validationEntries = Array.from(emailMap.entries()).map(([email, bouncedAt]) => ({ email, bouncedAt }));
    await Promise.all([
      this.msgOpsService.batchUpdateContactsBounce(contactEntries, accountId),
      this.msgOpsService.batchUpsertValidationBounce(validationEntries),
    ]);
    const emails = [...new Set(events.map((e) => e.email))];
    await this.createRedisKey(`${accountId}:disengaged`, emails, 48);
  }

  private async processTestAbEvent(events: TestAbEvent[]): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    await Promise.all(
      events.map(async (event) => {
        const testAbKey = `testab:campaign:${event.campaignId}:message:${event.messageId}`;
        if (await this.redisClient.exists(testAbKey)) {
          pipeline.hincrby(testAbKey, event.eventType, 1);
        }
      }),
    );
    const results = await pipeline.exec();
    this.handleRedisResults(results);
  }

  private async processAutomationTargetEvents(events: AutomationTargetEvent[]) {
    await Promise.all(events.map((e) => this.publishAutomationTarget(e)));
  }

  private async prefetchTimeZones(accountIds: number[]): Promise<Record<number, string>> {
    const timeZones: Record<number, string> = {};
    await Promise.all(
      accountIds.map(async (id) => {
        timeZones[id] = await this.msgOpsService.getAccountTimeZone(id);
      }),
    );
    return timeZones;
  }

  private async filterDuplicateEvents(events: ResendPayload[]): Promise<ResendPayload[]> {
    const pipeline = this.redisClient.pipeline();
    const eventIds = events.map((e) => e.re_event_id);
    eventIds.forEach((id) => {
      if (id) pipeline.set(`event:resend:${id}`, '1', 'EX', 10 * 60, 'NX');
    });
    const results = await pipeline.exec();
    return events.filter((event, index) => {
      if (!event.re_event_id) return true;
      if (results[index][1] !== 'OK') {
        console.log(`[Resend] Duplicate event: ${JSON.stringify(event)}`);
        return false;
      }
      return true;
    });
  }
}
