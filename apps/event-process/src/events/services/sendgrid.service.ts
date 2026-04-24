import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import { PlatformType } from '../interfaces/push.interfaces';
import {
  AutomationTargetEvent,
  ContactEditableAttributes,
  ContactValidateEditableAttributes,
  EventLog,
  EventsType,
  ProcessedGroup,
  SendgridBounceClassification,
  SendgridEvent,
  SendgridPayload,
  TestAbEvent,
  InternalEvent,
} from '../interfaces/events.interfaces';
import { QueryResult } from 'pg';
import { ChainableCommander } from 'ioredis';

@Injectable()
export class SendgridService extends EventsService {
  async processSendgrid(events: SendgridEvent): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload, account: providerAccount } = events;

    const uniqueEvents = await this.filterDuplicateEvents(payload);

    if (uniqueEvents.length === 0) {
      this.formatterUtils.logInfo(`[Sendgrid] All events were duplicates: ${JSON.stringify(events)}`);
      return { status: 'skipped', message: 'All events were duplicates' };
    }

    // Single initial loop to organize all data
    const pipeline = this.redisClient.pipeline();
    const { processedGroups, eventLogs, testAbEvents, automationTargetEvents, leadActivationEvents } =
      await this.organizeEventsData(uniqueEvents, providerAccount, pipeline);

    // Process test AB events if any
    if (testAbEvents.length > 0) {
      await this.processTestAbEvent(testAbEvents);
    }

    if (automationTargetEvents.length > 0) {
      await this.processAutomationTargetEvents(automationTargetEvents);
    }

    if (leadActivationEvents.length) {
      await this.processActivationEvents(leadActivationEvents);
    }

    await Promise.all([this.processAllEvents(processedGroups), this.saveLogs(eventLogs)]);

    const results = await pipeline.exec();
    this.handleRedisResults(results);

    return {};
  }

  private async organizeEventsData(
    events: SendgridPayload[],
    providerAccount: string,
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
        events: { type: string; eventList: SendgridPayload[] }[];
        eventMap: Map<string, { type: string; eventList: SendgridPayload[] }>;
        logs: EventLog[];
      }
    > = {};

    // Prefetch timezones for all accounts
    const accountIds = new Set<string>();
    events.forEach((event) => {
      const accountId = this.formatterUtils.parseEventType(event.category, 'account');
      if (accountId) accountIds.add(accountId);
    });

    const timeZones = await this.prefetchTimeZones(Array.from(accountIds).map(Number));
    const leadActivationEvents = [];

    // Single loop to organize all data
    for (const event of events) {
      const messageId = this.formatterUtils.parseEventType(event.category, 'message');
      const accountId = this.formatterUtils.parseEventType(event.category, 'account');

      if (event.event === EventsType.ACCOUNT_STATUS_CHANGE) {
        console.warn('Account status change', JSON.stringify(event));
        await this.formatterUtils.sendSlackWebhook({
          text: `:warning: Account *${providerAccount}* foi bloqueada na sendgrid. \`\`\`${JSON.stringify(event)}\`\`\``,
          account: providerAccount,
          showSupportButton: true,
        });

        // since we don't have accountId, we need to skip the rest of the loop
        continue;
      }

      if (!messageId || !accountId) {
        this.formatterUtils.logInfo(`[Event-Process] Missing sendgrid context: ${JSON.stringify(event)}`);
        continue;
      }

      // Initialize account group if not exists
      if (!accountGroups[accountId]) {
        accountGroups[accountId] = {
          accountId: Number(accountId),
          timeZone: timeZones[Number(accountId)],
          events: [],
          eventMap: new Map(),
          logs: [],
        };
      }

      // Skip invalid events
      if (!eventsToProcess.has(event.event as EventsType)) continue;

      // For bounce/blocked events, determine if it's a recipient issue (should update contact)
      // vs a sender issue (reputation/technical - should only log, not update contact)
      const isRecipientBounce =
        event.event === EventsType.BOUNCE || event.event === EventsType.BLOCKED
          ? this.isRecipientIssueBounce(event.reason, event.bounce_classification)
          : true;

      if (['open', 'click'].includes(event.event) && event.contactId && accountId) {
        const contactId = Number(event.contactId);
        const _accountId = Number(accountId);
        const contact = await this.msgOpsService.findContactById(_accountId, contactId);

        if (contact) {
          event.properties = { previousOpen: contact.last_open || 'null', previousClick: contact.last_click || 'null' };
        }

        if (
          contact &&
          (contact.last_open === null || contact.last_open < new Date(Date.now() - 1000 * 60 * 60 * 24 * 30))
        ) {
          const leadActivationEvent: InternalEvent = {
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
          };
          leadActivationEvents.push(leadActivationEvent);
        }
      }

      // Add geo data if needed
      if (['open', 'click'].includes(event.event) && event.ip) {
        const geoData = await this.getGeoIpInfo(event.ip);
        // Attach on any successful enrichment: country and traits are sourced
        // from the same MMDB lookup but a geo-less result may still carry
        // traits (and vice-versa), both of which are needed downstream.
        if (geoData.country || geoData.traits) {
          event.geoData = geoData;
        }

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

      // Handle dropped events
      if (event.event === EventsType.DROPPED) {
        if (event.reason === 'Unsubscribed Address' || event.reason === 'Spam Reporting Address') {
          const eventGroup = accountGroups[accountId].eventMap.get('unsubscribe');
          if (eventGroup) {
            eventGroup.eventList.push(event);
          } else {
            const newGroup = { type: 'unsubscribe', eventList: [event] };
            accountGroups[accountId].eventMap.set('unsubscribe', newGroup);
            accountGroups[accountId].events.push(newGroup);
          }
        }

        if (event.reason === 'Bounced Address') {
          // 'Bounced Address' means SendGrid is suppressing a previously hard-bounced address.
          // This is always a recipient issue (permanent failure), so treat it as a hard bounce.
          event.type = 'bounce';
          const eventGroup = accountGroups[accountId].eventMap.get('bounce');
          if (eventGroup) {
            eventGroup.eventList.push(event);
          } else {
            const newGroup = { type: 'bounce', eventList: [event] };
            accountGroups[accountId].eventMap.set('bounce', newGroup);
            accountGroups[accountId].events.push(newGroup);
          }
        }

        if (event.reason === 'Invalid SMTPAPI header') {
          console.warn('Invalid SMTPAPI header', JSON.stringify(event));
          await this.formatterUtils.sendSlackWebhook({
            text: `:warning: Invalid SMTPAPI header on *${providerAccount}* \`\`\`${JSON.stringify(event)}\`\`\``,
            account: providerAccount,
            showSupportButton: false,
          });
        }
      }

      // Add event to appropriate group, except:
      // - DROPPED events are handled above with their own routing logic
      // - Sender-issue bounce/blocked events (Reputation, Technical, Content) are log-only
      const isSenderIssueBounce =
        (event.event === EventsType.BOUNCE || event.event === EventsType.BLOCKED) && !isRecipientBounce;

      // Track A/B test events after sender-issue classification is known.
      // Sender-issue bounces are recorded as 'blocked' to keep A/B bounce rates
      // consistent with the main statistics pipeline.
      if (event.category && this.formatterUtils.parseEventType(event.category, 'testab-message')) {
        const campaignId = this.formatterUtils.parseEventType(event.category, 'campaign');
        const testAbEventType = isSenderIssueBounce ? EventsType.BLOCKED : event.event;
        testAbEvents.push({ campaignId, messageId, eventType: testAbEventType });
      }
      if (event.event !== EventsType.DROPPED && !isSenderIssueBounce) {
        const eventGroup = accountGroups[accountId].eventMap.get(event.event);
        if (eventGroup) {
          eventGroup.eventList.push(event);
        } else {
          const newGroup = { type: event.event, eventList: [event] };
          accountGroups[accountId].eventMap.set(event.event, newGroup);
          accountGroups[accountId].events.push(newGroup);
        }
      }

      // Prepare event log
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
          provider: 'sendgrid',
          provider_account: providerAccount || null,
          isTestAb: this.formatterUtils.parseEventType(event.category, 'testab-message') ? true : false,
          reason: event.reason || event.response || null,
          url:
            event.url && event.url.includes('","http')
              ? null
              : this.formatterUtils.removeQueryStringFromUrl(event.url) || null,
          pool: this.formatterUtils.parseEventType(event.category, 'pool') || null,
          ...(event.event === 'click' && event.url_offset ? { linkPosition: event.url_offset.index } : {}),
          ...(['delivered', 'deferred', 'open', 'click'].includes(event.event) && event.ip !== 'unknown'
            ? { ip: event.ip || null }
            : {}),
          ...(['open', 'click'].includes(event.event) && event.useragent !== ''
            ? this.userAgentFormatter(event.useragent)
            : {}),
          ...(['delivered', 'deferred', 'open'].includes(event.event) && event.sent_at && event.timestamp
            ? { secondsSinceSent: Math.floor(event.timestamp - Number(event.sent_at) / 1000) }
            : {}),
          ...(event.geoData || {}),
          properties: {
            ...(event?.properties || {}),
            ...(event.event === EventsType.DEFERRED && event.attempt !== undefined ? { attempt: event.attempt } : {}),
            ...([EventsType.BOUNCE, EventsType.BLOCKED].includes(event.event as EventsType)
              ? {
                  bounce_classification: event.bounce_classification || null,
                  bounce_type: event.type === 'blocked' || event.event === EventsType.BLOCKED ? 'SOFT' : 'HARD',
                  status: event.status || null,
                }
              : {}),
          },
          delivered_id: event.sg_message_id || '',
        };

        accountGroups[accountId].logs.push(eventLog);
      }

      if (event.reason && event.reason === 'Invalid SMTPAPI header') {
        continue;
      }

      const eventType = this.formatterUtils.parseEventType(event.category, 'type');
      const campaignId = this.formatterUtils.parseEventType(event.category, 'campaign');
      const automationId = this.formatterUtils.parseEventType(event.category, 'automation-id');

      // Sender-issue bounces (Reputation, Technical, Content) are tracked as 'blocked'
      // to keep the 'bounce' counter clean for recipient-issue bounces only
      const statisticsEvent = isSenderIssueBounce ? EventsType.BLOCKED : event.event;

      this.updateEventStatistics(pipeline, {
        timeZone: accountGroups[accountId].timeZone,
        accountId: Number(accountId),
        messageId: Number(messageId),
        event: statisticsEvent,
        contactId: Number(event.contactId),
        platform: PlatformType.EMAIL,
        type: eventType === 'email' ? 'automation' : eventType === 'campaign' ? 'campaign' : 'transactional',
        eventId: eventType === 'campaign' && Number(campaignId) ? Number(campaignId) : Number(automationId) || 0,
        pool: this.formatterUtils.parseEventType(event.category, 'pool'),
        utmCampaign: this.formatterUtils.parseEventType(event.category, 'utmcampaign'),
        providerAccount: providerAccount,
        linkPosition: event.url_offset?.index,
        userAgent: event.useragent,
        ip: event.ip,
        emailProvider: this.formatterUtils.getMailBoxProvider(event.email),
        isTestAb: this.formatterUtils.parseEventType(event.category, 'testab-message') ? true : false,
        timestamp: event.timestamp,
        sent_at: event.sent_at,
        batch_page: event.batch_page,
        batch_schedule_to: event.batch_schedule_to,
        batch_spread: event.batch_spread,
        email: event.email,
        ...(event.geoData ? { geoData: event.geoData } : {}),
      });
    }

    const processedGroups: ProcessedGroup[] = Object.values(accountGroups);
    const eventLogs: EventLog[][] = Object.values(accountGroups).map((group) => group.logs);

    return { processedGroups, eventLogs, testAbEvents, automationTargetEvents, leadActivationEvents };
  }

  private async saveLogs(eventLogs: EventLog[][]): Promise<void> {
    await Promise.all(
      eventLogs.map(async (accountEvents) => {
        await this.sendKafkaMessage(accountEvents);
        await this.msgOpsService.saveEventsLogs(accountEvents);
      }),
    );
  }

  private async processAllEvents(groups: ProcessedGroup[]): Promise<void> {
    // Process each group of events
    await Promise.all(
      groups.flatMap(({ accountId, timeZone, events }) =>
        events.map(async ({ type, eventList }) => {
          // Process triggers for open/click events
          if (type === 'open' || type === 'click') {
            await this.eventsTrigger(type, eventList, accountId);
          }

          // Process events
          await this.updateContact(type, accountId, timeZone, eventList);
        }),
      ),
    );
  }

  private async updateContact(
    type: string,
    accountId: number,
    timeZone: string,
    events: SendgridPayload[],
  ): Promise<QueryResult> {
    const ids = [
      ...new Set(
        events
          .filter((event) => event.contactId && !isNaN(Number(event.contactId)))
          .map((event) => Number(event.contactId)),
      ),
    ];
    const emails = [...new Set(events.map((event) => event.email))];
    const averageTimestamp = events[0].timestamp * 1000;

    const changes: ContactEditableAttributes = {};
    const changesValidate: ContactValidateEditableAttributes = {};
    switch (type) {
      case EventsType.DELIVERED:
        changes.lastSent = new Date(averageTimestamp);
        changes.lastSentDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        break;
      case EventsType.OPEN:
        changes.lastOpen = new Date(averageTimestamp);
        changes.lastOpenDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        changesValidate.lastOpen = new Date(averageTimestamp);
        changes.isActive = true;
        break;
      case EventsType.CLICK:
        changes.lastOpen = new Date(averageTimestamp);
        changes.lastOpenDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        changes.lastClick = new Date(averageTimestamp);
        changes.lastClickDate = this.formatterUtils.convertTimestampToTimezone(averageTimestamp, timeZone);
        changesValidate.lastClick = new Date(averageTimestamp);
        changes.isActive = true;
        break;
      case EventsType.UNSUBSCRIBE:
      case EventsType.GROUPUNSUBSCRIBE:
      case EventsType.SPAMREPORT:
        changes.isUnsubscribed = true;
        changes.unsubscribedAt = new Date(averageTimestamp);
        changesValidate.unsubscribedAt = new Date(averageTimestamp);
        await this.createRedisKey(`${accountId}:unsubscribed`, emails, 168);
        break;
      case EventsType.BOUNCE:
      case EventsType.BLOCKED:
        // Handle bounces by splitting into hard and soft groups
        // to ensure each contact gets the correct bounce_type
        await this.updateBouncedContacts(type, accountId, events);
        return; // Early return - updateBouncedContacts handles everything
      case EventsType.GROUPRESUBSCRIBE:
        // User resubscribed to a suppression group - clear unsubscribed status
        changes.isUnsubscribed = false;
        changes.unsubscribedAt = null;
        await this.msgOpsService.clearValidationUnsubscribed(emails);
        await this.deleteRedisKey(`${accountId}:unsubscribed`, emails);
        break;
      default:
        return;
    }

    if (ids.length) {
      await this.msgOpsService.updateContactsById(ids, accountId, changes);
    }

    if (emails.length && Object.keys(changesValidate).length) {
      await this.msgOpsService.updateContactsValidateByEmail(emails, changesValidate);
    }

    return;
  }

  /**
   * Handles bounce/blocked events by splitting them into hard and soft bounces
   * to ensure each contact gets the correct bounce_type.
   *
   * This is necessary because events are grouped by event type (bounce/blocked),
   * but a single batch can contain both hard and soft bounces for different contacts.
   */
  private async updateBouncedContacts(type: string, accountId: number, events: SendgridPayload[]): Promise<void> {
    // Split events into hard and soft bounces
    // - BLOCKED event type is always soft
    // - BOUNCE event type: check the 'type' field ('bounce' = hard, 'blocked' = soft)
    const hardBounces = events.filter((e) => type === EventsType.BOUNCE && e.type !== 'blocked');
    const hardContactIds = new Set(
      hardBounces.filter((e) => e.contactId && !isNaN(Number(e.contactId))).map((e) => Number(e.contactId)),
    );

    // Hard bounce wins: exclude contacts already in hardBounces from softBounces
    // so a contact that received both a hard and soft event in one batch keeps HARD
    const softBounces = events
      .filter((e) => type === EventsType.BLOCKED || e.type === 'blocked')
      .filter((e) => !e.contactId || isNaN(Number(e.contactId)) || !hardContactIds.has(Number(e.contactId)));

    // Process hard bounces
    if (hardBounces.length > 0) {
      await this.updateContactsWithBounceType(accountId, hardBounces, 'HARD');
    }

    // Process soft bounces
    if (softBounces.length > 0) {
      await this.updateContactsWithBounceType(accountId, softBounces, 'SOFT');
    }
  }

  private async updateContactsWithBounceType(
    accountId: number,
    events: SendgridPayload[],
    bounceType: 'HARD' | 'SOFT',
  ): Promise<void> {
    // Deduplicate by contactId and by email, keeping the latest timestamp in each case.
    // Duplicates in one VALUES list cause Postgres to apply an arbitrary row
    // for each target row, making bounced_at nondeterministic.
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

    // Two SQL statements regardless of batch size
    await Promise.all([
      this.msgOpsService.batchUpdateContactsBounce(contactEntries, accountId),
      this.msgOpsService.batchUpsertValidationBounce(validationEntries),
    ]);

    const emails = [...new Set(events.map((e) => e.email))];
    await this.createRedisKey(`${accountId}:disengaged`, emails, 48);
  }

  /**
   * Determines if a bounce is due to a recipient issue (should mark contact as bounced)
   * vs a sender issue (reputation, technical, content - should only log, not update contact)
   *
   * Recipient issues: Invalid Address, Mailbox Unavailable
   * Sender issues: Reputation (IP blocked, spam), Technical, Content, Unclassified
   */
  private isRecipientIssueBounce(reason: string, bounceClass: string): boolean {
    const recipientIssueClassifications = [
      SendgridBounceClassification.INVALID_ADDRESS,
      SendgridBounceClassification.MAILBOX_UNAVAILABLE,
    ];

    if (recipientIssueClassifications.some((item) => item === bounceClass)) {
      return true;
    }

    // Fallback: check reason strings for recipient issues not properly classified
    const recipientIssueReasons = [
      'The email account that you tried to reach is over quota',
      'The email account that you tried to reach does not exist',
      'Quota exceeded',
      'User unknown',
      'mailbox not found',
      'mailbox is over quota',
    ];

    if (reason && recipientIssueReasons.some((item) => reason.toLowerCase().includes(item.toLowerCase()))) {
      return true;
    }

    return false;
  }

  private async processTestAbEvent(events: TestAbEvent[]): Promise<void> {
    const pipeline = this.redisClient.pipeline();

    await Promise.all(
      events.map(async (event) => {
        let eventType: string | null = null;
        switch (event.eventType) {
          case EventsType.DELIVERED:
            eventType = EventsType.DELIVERED;
            break;
          case EventsType.OPEN:
            eventType = EventsType.OPEN;
            break;
          case EventsType.CLICK:
            eventType = EventsType.CLICK;
            break;
          case EventsType.UNSUBSCRIBE:
          case EventsType.GROUPUNSUBSCRIBE:
          case EventsType.SPAMREPORT:
            eventType = EventsType.UNSUBSCRIBE;
            break;
          case EventsType.BOUNCE:
            eventType = EventsType.BOUNCE;
            break;
          case EventsType.BLOCKED:
            // Sender-issue bounces (Reputation, Technical, Content) use their
            // own counter so A/B bounce rates only reflect recipient issues
            eventType = EventsType.BLOCKED;
            break;
        }

        const testAbKey = `testab:campaign:${event.campaignId}:message:${event.messageId}`;
        const redisExist = await this.redisClient.exists(testAbKey);
        if (eventType && redisExist) {
          pipeline.hincrby(testAbKey, eventType, 1);
        }
      }),
    );

    const results = await pipeline.exec();
    this.handleRedisResults(results);
  }

  private async processAutomationTargetEvents(events: AutomationTargetEvent[]) {
    await Promise.all(
      events.map(async (event) => {
        await this.publishPubsubAutomationTarget(event);
      }),
    );
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

  private async filterDuplicateEvents(events: SendgridPayload[]): Promise<SendgridPayload[]> {
    const pipeline = this.redisClient.pipeline();
    const eventIds = events.map((event) => event.sg_event_id);

    eventIds.forEach((eventId) => {
      if (eventId) {
        pipeline.set(`event:sendgrid:${eventId}`, '1', 'EX', 10 * 60, 'NX');
      }
    });

    const results = await pipeline.exec();

    return events.filter((event, index) => {
      if (results[index][1] !== 'OK') {
        console.log(`[Sendgrid] Duplicate event: ${JSON.stringify(event)}`);
        return false;
      }

      return true;
    });
  }
}
