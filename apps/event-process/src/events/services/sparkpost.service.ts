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
  SparkPostEnvelope,
  SparkPostEvent,
  SparkPostEventTypes,
  SparkPostPayload,
  SparkPostRawEvent,
  SPARKPOST_HARD_BOUNCE_CLASSES,
  SPARKPOST_RECIPIENT_BOUNCE_CLASSES,
  INFORMATIONAL_OR_REMAP_CLASSES,
  TestAbEvent,
  InternalEvent,
} from '../interfaces/events.interfaces';
import { QueryResult } from 'pg';
import { ChainableCommander } from 'ioredis';

@Injectable()
export class SparkpostService extends EventsService {
  async processSparkPost(events: SparkPostEvent): Promise<any> {
    await this.msgOpsService.checkPostgresConnection();

    const { payload, account: providerAccount } = events;

    const normalized = this.normalizeEnvelopes(payload);

    if (normalized.length === 0) {
      this.formatterUtils.logInfo(`[Sparkpost] No processable events in payload: ${JSON.stringify(events)}`);
      return { status: 'skipped', message: 'No processable events' };
    }

    const uniqueEvents = await this.filterDuplicateEvents(normalized);

    if (uniqueEvents.length === 0) {
      this.formatterUtils.logInfo(`[Sparkpost] All events were duplicates: ${JSON.stringify(events)}`);
      return { status: 'skipped', message: 'All events were duplicates' };
    }

    const pipeline = this.redisClient.pipeline();
    const { processedGroups, eventLogs, testAbEvents, automationTargetEvents, leadActivationEvents } =
      await this.organizeEventsData(uniqueEvents, providerAccount, pipeline);

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

  // ─────────────────────────────────────────────────────────────
  // Envelope normalization
  // ─────────────────────────────────────────────────────────────

  // SparkPost wraps each event in `msys.<class>_event`. Unwrap and map
  // to a SendGrid-shaped payload so the rest of the pipeline mirrors
  // SendgridService 1:1. rcpt_meta (object) is serialized into a
  // `category: string[]` so parseEventType / statistics can be reused.
  private normalizeEnvelopes(envelopes: SparkPostEnvelope[]): SparkPostPayload[] {
    const out: SparkPostPayload[] = [];
    for (const envelope of envelopes || []) {
      const eventClass = envelope?.msys ? Object.keys(envelope.msys)[0] : null;
      const raw = eventClass ? ((envelope.msys as any)[eventClass] as SparkPostRawEvent) : null;
      if (!raw) continue;

      const mappedEvent = this.mapSparkPostEventType(raw.type);
      if (!mappedEvent) {
        // relay_* events are SparkPost inbound relay traffic — irrelevant for
        // outbound messaging. Silently skip to avoid log spam if a tenant
        // has inbound relay enabled. Only log truly unknown types.
        if (eventClass !== 'relay_event' && !raw.type?.startsWith('relay_')) {
          this.formatterUtils.logInfo(`[Sparkpost] Skipping unsupported event type: ${raw.type} (${eventClass})`);
        }
        continue;
      }

      const normalized = this.normalizePayload(raw, mappedEvent);
      // normalizePayload returns null for informational bounce classes
      // (e.g. SparkPost class 80 = Subscribe ARF) we explicitly drop.
      if (normalized) out.push(normalized);
    }
    return out;
  }

  private normalizePayload(raw: SparkPostRawEvent, mappedEvent: string): SparkPostPayload {
    const rcptMeta = raw.rcpt_meta || {};
    // Convert rcpt_meta object into SendGrid-style category array so
    // formatterUtils.parseEventType('account' | 'message' | ...) keeps working.
    const category = Object.entries(rcptMeta).map(([k, v]) => `${k}:${v}`);

    const bounceClass = raw.bounce_class !== undefined ? Number(raw.bounce_class) : undefined;
    const bounceClassification = bounceClass !== undefined ? `class_${bounceClass}` : undefined;

    // Informational bounce classes (80=Subscribe, 90=Unsubscribe ARF, 100=Challenge-Response)
    // are not real bounces. SparkPost emits them with type='bounce' but the contact-side
    // semantics differ:
    //   80 — user (re)subscribed: drop entirely, nothing to update
    //   90 — user unsubscribed via List-Unsubscribe-Post: remap to UNSUBSCRIBE
    //  100 — challenge-response (recipient inbox has CR filter): HARD recipient bounce
    let effectiveEvent = mappedEvent;
    if (
      mappedEvent === EventsType.BOUNCE &&
      bounceClass !== undefined &&
      INFORMATIONAL_OR_REMAP_CLASSES.has(bounceClass)
    ) {
      if (bounceClass === 80) {
        // Subscribe ARF: explicitly drop — pipeline shouldn't see this event.
        return null as unknown as SparkPostPayload;
      }
      if (bounceClass === 90) {
        effectiveEvent = EventsType.UNSUBSCRIBE;
      }
      // Class 100 stays as BOUNCE; it's a HARD recipient class added inline below.
    }

    const isRecipient =
      bounceClass !== undefined && (SPARKPOST_RECIPIENT_BOUNCE_CLASSES.has(bounceClass) || bounceClass === 100);
    // For bounce events we mirror SendGrid's `type` semantics: 'bounce' → HARD,
    // 'blocked' → SOFT. Recipient classes we know to be soft (e.g. mailbox full)
    // are flagged as 'blocked'; the rest of recipient classes stay HARD.
    let synthType: string | undefined;
    if (effectiveEvent === EventsType.BOUNCE) {
      if (isRecipient) {
        const isHard = SPARKPOST_HARD_BOUNCE_CLASSES.has(bounceClass) || bounceClass === 100;
        synthType = isHard ? 'bounce' : 'blocked';
      } else {
        // Sender-issue: keep the original sparkpost type, marker doesn't matter
        // because organizeEventsData routes sender bounces to 'blocked' anyway.
        synthType = raw.type;
      }
    }

    const contactIdMeta = rcptMeta.contactId !== undefined ? String(rcptMeta.contactId) : undefined;
    const messageIdMeta = rcptMeta.message !== undefined ? String(rcptMeta.message) : undefined;

    return {
      email: raw.rcpt_to || raw.raw_rcpt_to || '',
      timestamp: this.parseTimestamp(raw.timestamp),
      event: effectiveEvent,
      sparkpostType: raw.type,
      category,
      sp_event_id: raw.event_id || '',
      // message_id is per-recipient (canonical key for correlating
      // delivery↔open↔click). transmission_id is the per-batch SP id and is
      // kept in properties for observability when tracing batches.
      sp_message_id: raw.message_id || raw.transmission_id || '',
      sp_transmission_id: raw.transmission_id,
      reason: raw.reason || raw.raw_reason,
      attempt: raw.num_retries,
      type: synthType,
      ip: raw.ip_address,
      useragent: raw.user_agent,
      url: raw.target_link_url,
      contactId: contactIdMeta,
      messageId: messageIdMeta,
      bounce_class: bounceClass,
      bounce_classification: bounceClassification,
      status: raw.error_code,
      properties: undefined,
      // SparkPost ships native geo on the event; keep it but the pipeline may
      // override with a higher-fidelity MMDB result for opens/clicks below.
      geoData: raw.geo_ip
        ? {
            country: raw.geo_ip.country,
            region: raw.geo_ip.region,
            city: raw.geo_ip.city,
          }
        : undefined,
    };
  }

  // SparkPost emits timestamps as unix epoch seconds (string or number) in
  // most webhooks, but some endpoints/versions ship ISO 8601. Returns 0
  // sentinel when missing or unparseable so the caller can decide whether
  // to drop the event — events with timestamp=0 still reach ClickHouse
  // bucketed at epoch otherwise (new Date(0) is truthy, so the
  // processMessageToAnalytics `!message.time` guard does NOT filter them).
  private parseTimestamp(ts: number | string | undefined): number {
    if (ts === undefined || ts === null || ts === '') return 0;
    const n = typeof ts === 'number' ? ts : Number(ts);
    if (Number.isFinite(n)) return n;
    // String wasn't numeric — try ISO 8601 (e.g. '2026-05-07T12:34:56Z').
    const parsed = Date.parse(String(ts));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  }

  // SparkPost event types → MsgopsEvent / EventsType.
  // Returns null for events we explicitly drop (relays, AB test stats,
  // unknown types). Mapping decisions are documented in the tech-spec
  // (EVO-1029, Phase 2 / Task 13).
  private mapSparkPostEventType(type: string): string | null {
    switch (type) {
      case SparkPostEventTypes.DELIVERY:
        return EventsType.DELIVERED;
      case SparkPostEventTypes.BOUNCE:
      case SparkPostEventTypes.OUT_OF_BAND:
        return EventsType.BOUNCE;
      case SparkPostEventTypes.INJECTION:
        return EventsType.PROCESSED;
      case SparkPostEventTypes.POLICY_REJECTION:
        return EventsType.DROPPED;
      case SparkPostEventTypes.DELAY:
        return EventsType.DEFERRED;
      case SparkPostEventTypes.OPEN:
      case SparkPostEventTypes.INITIAL_OPEN:
      case SparkPostEventTypes.AMP_OPEN:
      case SparkPostEventTypes.AMP_INITIAL_OPEN:
        return EventsType.OPEN;
      case SparkPostEventTypes.CLICK:
      case SparkPostEventTypes.AMP_CLICK:
        return EventsType.CLICK;
      case SparkPostEventTypes.LIST_UNSUBSCRIBE:
      case SparkPostEventTypes.LINK_UNSUBSCRIBE:
        return EventsType.UNSUBSCRIBE;
      case SparkPostEventTypes.SPAM_COMPLAINT:
        return EventsType.SPAMREPORT;
      case SparkPostEventTypes.GENERATION_FAILURE:
      case SparkPostEventTypes.GENERATION_REJECTION:
        return EventsType.DROPPED;
      default:
        return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Pipeline (mirror of SendgridService.organizeEventsData)
  // ─────────────────────────────────────────────────────────────

  private async organizeEventsData(
    events: SparkPostPayload[],
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
        events: { type: string; eventList: SparkPostPayload[] }[];
        eventMap: Map<string, { type: string; eventList: SparkPostPayload[] }>;
        logs: EventLog[];
      }
    > = {};

    // Prefetch timezones for all distinct accounts in this batch.
    const accountIds = new Set<string>();
    events.forEach((event) => {
      const accountId = this.formatterUtils.parseEventType(event.category, 'account');
      if (accountId) accountIds.add(accountId);
    });

    const timeZones = await this.prefetchTimeZones(Array.from(accountIds).map(Number));
    const leadActivationEvents: InternalEvent[] = [];

    // SparkPost has no dedicated `account_status_change` event like SendGrid.
    // When a subaccount is suspended SP emits a burst of policy_rejection
    // events with reason text indicating account-level block. Slack once
    // per webhook batch so a 5k-event suspension burst doesn't spam ops.
    const accountSuspensionRegex = /(subaccount|account).{0,20}(suspend|block)/i;
    const suspensionEvent = events.find(
      (e) => e.sparkpostType === 'policy_rejection' && e.reason && accountSuspensionRegex.test(e.reason),
    );
    if (suspensionEvent) {
      console.warn('SparkPost account suspension', JSON.stringify(suspensionEvent));
      await this.formatterUtils.sendSlackWebhook({
        text: `:warning: Subaccount *${providerAccount ?? 'unknown'}* foi bloqueada/suspensa na SparkPost. \`\`\`${JSON.stringify(suspensionEvent)}\`\`\``,
        account: providerAccount,
        showSupportButton: true,
      });
    }

    for (const event of events) {
      const messageId = this.formatterUtils.parseEventType(event.category, 'message');
      const accountId = this.formatterUtils.parseEventType(event.category, 'account');

      if (!messageId || !accountId) {
        this.formatterUtils.logInfo(`[Event-Process] Missing sparkpost context: ${JSON.stringify(event)}`);
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

      // Recipient vs sender bounce: drives both contact-update and statistics
      // routing. SparkPost classifies via numeric `bounce_class`; reason text
      // is a fallback for events lacking classification.
      const isRecipientBounce =
        event.event === EventsType.BOUNCE || event.event === EventsType.BLOCKED
          ? this.isRecipientIssueBounce(event.reason, event.bounce_class)
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

      // MMDB enrichment + automation target check. SparkPost ships native
      // geo_ip on the payload (already mapped in normalizePayload), so we only
      // pay the MMDB roundtrip when traits (BotDetector signals) are needed
      // for clicks. Country/region/city already present on event.geoData take
      // precedence over the MMDB result for those fields.
      if (['open', 'click'].includes(event.event) && event.ip) {
        const needsTraits = event.event === 'click';
        if (needsTraits || !event.geoData?.country) {
          const geoData = await this.getGeoIpInfo(event.ip);
          if (geoData.country || geoData.traits) {
            event.geoData = {
              country: event.geoData?.country || geoData.country,
              region: event.geoData?.region || geoData.region,
              city: event.geoData?.city || geoData.city,
              traits: geoData.traits,
            };
          }
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

      // SparkPost policy_rejection events are mapped to DROPPED. They can
      // mean two different things depending on `reason`:
      //   - Recipient was on the SparkPost suppression list (rcpt unsubscribed
      //     previously) → remap to UNSUBSCRIBE so we mirror the user's intent.
      //   - True policy/content rejection → keep as DROPPED (log-only).
      // SendgridService does the equivalent for dropped+'Unsubscribed Address'.
      if (
        event.event === EventsType.DROPPED &&
        event.sparkpostType === 'policy_rejection' &&
        event.reason &&
        /suppress|unsubscrib/i.test(event.reason)
      ) {
        const eventGroup = accountGroups[accountId].eventMap.get('unsubscribe');
        if (eventGroup) {
          eventGroup.eventList.push(event);
        } else {
          const newGroup = { type: 'unsubscribe', eventList: [event] };
          accountGroups[accountId].eventMap.set('unsubscribe', newGroup);
          accountGroups[accountId].events.push(newGroup);
        }
      }

      // Sender-issue bounces are routed to the 'blocked' counter so the
      // 'bounce' counter only reflects recipient permanent failures.
      const isSenderIssueBounce =
        (event.event === EventsType.BOUNCE || event.event === EventsType.BLOCKED) && !isRecipientBounce;

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
          provider: 'sparkpost',
          provider_account: providerAccount || null,
          isTestAb: this.formatterUtils.parseEventType(event.category, 'testab-message') ? true : false,
          reason: event.reason || null,
          url: event.url ? this.formatterUtils.removeQueryStringFromUrl(event.url) || null : null,
          pool: this.formatterUtils.parseEventType(event.category, 'pool') || null,
          ...(['delivered', 'deferred', 'open', 'click'].includes(event.event) && event.ip && event.ip !== 'unknown'
            ? { ip: event.ip }
            : {}),
          ...(['open', 'click'].includes(event.event) && event.useragent
            ? this.userAgentFormatter(event.useragent)
            : {}),
          ...(event.geoData || {}),
          properties: {
            ...(event?.properties || {}),
            ...(event.event === EventsType.DEFERRED && event.attempt !== undefined ? { attempt: event.attempt } : {}),
            ...(event.sp_transmission_id ? { sparkpost_transmission_id: event.sp_transmission_id } : {}),
            ...([EventsType.BOUNCE, EventsType.BLOCKED].includes(event.event as EventsType)
              ? {
                  bounce_classification: event.bounce_classification || null,
                  bounce_class: event.bounce_class ?? null,
                  bounce_type: event.type === 'blocked' || event.event === EventsType.BLOCKED ? 'SOFT' : 'HARD',
                  status: event.status || null,
                  sparkpost_type: event.sparkpostType,
                }
              : {}),
          },
          delivered_id: event.sp_message_id || '',
        };

        accountGroups[accountId].logs.push(eventLog);
      }

      const eventType = this.formatterUtils.parseEventType(event.category, 'type');
      const campaignId = this.formatterUtils.parseEventType(event.category, 'campaign');
      const automationId = this.formatterUtils.parseEventType(event.category, 'automation-id');

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
      // ProcessedGroup is typed against SendgridPayload, but downstream
      // updateContact only reads contactId / email / timestamp — common to both.
      events: group.events as any,
    }));
    const eventLogs: EventLog[][] = Object.values(accountGroups).map((group) => group.logs);

    return { processedGroups, eventLogs, testAbEvents, automationTargetEvents, leadActivationEvents };
  }

  private async saveLogs(eventLogs: EventLog[][]): Promise<void> {
    await Promise.all(
      eventLogs.map(async (accountEvents) => {
        await this.sendAnalyticsEvent(accountEvents);
        await this.msgOpsService.saveEventsLogs(accountEvents);
      }),
    );
  }

  private async processAllEvents(groups: ProcessedGroup[]): Promise<void> {
    await Promise.all(
      groups.flatMap(({ accountId, timeZone, events }) =>
        events.map(async ({ type, eventList }) => {
          if (type === 'open' || type === 'click') {
            await this.eventsTrigger(type, eventList as any, accountId);
          }

          await this.updateContact(type, accountId, timeZone, eventList as any);
        }),
      ),
    );
  }

  private async updateContact(
    type: string,
    accountId: number,
    timeZone: string,
    events: SparkPostPayload[],
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
        await this.updateBouncedContacts(type, accountId, events);
        return;
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

  // Mirrors SendgridService.updateBouncedContacts: split bounce/blocked into
  // HARD and SOFT groups so each contact gets the correct bounce_type. Hard
  // wins when the same contact appears in both groups in one batch.
  private async updateBouncedContacts(type: string, accountId: number, events: SparkPostPayload[]): Promise<void> {
    const hardBounces = events.filter((e) => type === EventsType.BOUNCE && e.type !== 'blocked');
    const hardContactIds = new Set(
      hardBounces.filter((e) => e.contactId && !isNaN(Number(e.contactId))).map((e) => Number(e.contactId)),
    );

    const softBounces = events
      .filter((e) => type === EventsType.BLOCKED || e.type === 'blocked')
      .filter((e) => !e.contactId || isNaN(Number(e.contactId)) || !hardContactIds.has(Number(e.contactId)));

    if (hardBounces.length > 0) {
      await this.updateContactsWithBounceType(accountId, hardBounces, 'HARD');
    }

    if (softBounces.length > 0) {
      await this.updateContactsWithBounceType(accountId, softBounces, 'SOFT');
    }
  }

  private async updateContactsWithBounceType(
    accountId: number,
    events: SparkPostPayload[],
    bounceType: 'HARD' | 'SOFT',
  ): Promise<void> {
    // Dedup by contactId and by email keeping latest timestamp — duplicates
    // in one VALUES list make Postgres pick an arbitrary row, leaving
    // bounced_at nondeterministic.
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

  // Recipient-issue classifier: SparkPost's numeric `bounce_class` is the
  // primary signal. Reason text is the fallback for events that lack the
  // class field, mirroring SendGrid's regex set.
  private isRecipientIssueBounce(reason: string | undefined, bounceClass: number | undefined): boolean {
    if (bounceClass !== undefined && SPARKPOST_RECIPIENT_BOUNCE_CLASSES.has(bounceClass)) {
      return true;
    }

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
        await this.publishAutomationTarget(event);
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

  private async filterDuplicateEvents(events: SparkPostPayload[]): Promise<SparkPostPayload[]> {
    const pipeline = this.redisClient.pipeline();
    const eventIds = events.map((event) => event.sp_event_id);

    eventIds.forEach((eventId) => {
      if (eventId) {
        pipeline.set(`event:sparkpost:${eventId}`, '1', 'EX', 10 * 60, 'NX');
      }
    });

    const results = await pipeline.exec();

    return events.filter((event, index) => {
      if (!event.sp_event_id) return true;
      if (results[index][1] !== 'OK') {
        console.log(`[Sparkpost] Duplicate event: ${JSON.stringify(event)}`);
        return false;
      }

      return true;
    });
  }
}
