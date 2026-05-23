import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  LeadMessage,
  TagBatch,
  Actions,
  SegmentStatus,
  EventsTrigger,
  Status,
  SegmentToClickHouse,
  SegmentExternalQueryPayload,
} from './interfaces';
import { AutomationHandler } from './handlers/automation.handler';
import { MsgopsService } from './msgops/msgops.service';
import { QueuePublisher } from './providers/queue/queue.publisher';
import { createHash, randomUUID } from 'crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { RedisService } from './providers/redis/redis.service';
import { TrackerService } from './tracker/tracker.service';
import { generateForSegment } from '@msgops/segment-query-builder';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AppService {
  constructor(
    private readonly automationHandler: AutomationHandler,
    private readonly msgopsService: MsgopsService,
    private readonly queuePublisher: QueuePublisher,
    private readonly redisService: RedisService,
    private readonly trackerService: TrackerService,
  ) {}

  async addTag(leadAutomation: LeadMessage) {
    this.trackerService.logInfo(
      `[Automation] received message - ${leadAutomation.contact.id} - ${leadAutomation.tagName}`,
    );

    try {
      if (!leadAutomation.tagName && !leadAutomation.webPush && !leadAutomation.mobilePush) {
        this.trackerService.logInfo(`[automation] Can't process without a tagName. ${JSON.stringify(leadAutomation)}`);
        return;
      }

      await this.automationHandler.addTagAndStartAutomation(leadAutomation);

      return this.processReturn(200, `[Automation] Message successfully processed! - ${leadAutomation.contact.id}`);
    } catch (error) {
      console.error(error);
      this.processMessageCatchError(error);
    }
  }

  async removeTag(leadAutomation: LeadMessage) {
    this.trackerService.logInfo(`[remove tag] received message - ${leadAutomation.contact.id}`);

    try {
      await this.automationHandler.cancelRunningAutomation(leadAutomation, true);

      return this.processReturn(200, `Tag Removed! - ${leadAutomation.contact.id}`);
    } catch (error) {
      this.processMessageCatchError(error);
    }
  }

  async automationCancel(leadAutomation: LeadMessage) {
    this.trackerService.logInfo(`[automation cancel] received message - ${leadAutomation.contact.id}`);

    try {
      await this.automationHandler.cancelRunningAutomation(leadAutomation, false);

      return this.processReturn(200, `Automation Canceled! - ${leadAutomation.contact.id}`);
    } catch (error) {
      this.processMessageCatchError(error);
    }
  }

  private processReturn(status, message) {
    return { status, message };
  }

  private processMessageCatchError(error: any) {
    throw new HttpException(`Message process error ${error.message || JSON.stringify(error)}`, 400);
  }

  async processTagBatch(tagBatch: TagBatch) {
    try {
      const { account } = await this.msgopsService.findAccountByConfig('api_key', tagBatch.apiKey);
      if (!account) {
        throw new Error(`[Tag-Batch] Account not found: ${tagBatch.apiKey}`);
      }

      const tag = await this.msgopsService.getTagByName(tagBatch.tag, account.id);
      if (!tag) {
        throw new Error(`[Tag-Batch] Tag not found: ${tagBatch.tag}`);
      }

      const emails = tagBatch.contacts.map((contact) => contact.email);
      this.trackerService.logInfo(`Email received: ${JSON.stringify(emails)}`);
      const contacts = await this.msgopsService.findContactsByEmail(emails, account.id);
      this.trackerService.logInfo(`Contacts found: ${contacts.length}`);
      const parseContacts = [];

      for (const contact of contacts) {
        const findIndex = tagBatch.contacts.findIndex((contactBatch) => contactBatch.email == contact.email);
        tagBatch.contacts.splice(findIndex, 1);
        if (tagBatch.action === Actions.REMOVE) {
          parseContacts.push(contact.id);
        } else {
          parseContacts.push({ contactId: contact.id, tagId: tag.id, accountId: account.id });
        }
      }

      if (tagBatch.action === Actions.REMOVE) {
        this.trackerService.logInfo(`Remove Contacts Tag: ${tag.id} | ${JSON.stringify(parseContacts)}`);
        await this.msgopsService.deleteContactTagBatch(parseContacts, tag.id, account.id);
      } else {
        await this.msgopsService.createContactTagBatch(parseContacts);
        if (tagBatch.contacts.length && tagBatch.createContacts) {
          tagBatch.accountId = account.id;
          tagBatch.tagId = tag.id;
          await this.queuePublisher.publishContactsBatch(tagBatch);
        }
      }

      return this.processReturn(200, `[Contacts Tag] -  Created contacts tag: ${tagBatch.tag}!`);
    } catch (error) {
      console.error(error);
      return this.processReturn(200, `[Contacts Tag] -  Invalid payload: ${JSON.stringify(tagBatch)}!`);
    }
  }

  async processContactsBatch(contactsBatch: TagBatch) {
    try {
      const contacts = await contactsBatch.contacts.map((contact) => {
        return {
          ...contact,
          accountId: contactsBatch.accountId,
          hashedEmail: createHash('sha256').update(contact.email).digest('hex'),
          uuid: createHash('sha1').update(`BMS${contactsBatch.accountId}-${contact.email}`).digest('hex'),
          emailProvider: this.getMailBoxProvider(contact.email),
        };
      });
      const contactsIds: any = await this.msgopsService.createContactsBatch(contacts);
      const contactsTags = [];
      await contactsIds.identifiers.forEach((contact) => {
        if (contact) {
          contactsTags.push({
            contactId: contact.id,
            tagId: contactsBatch.tagId,
            accountId: contactsBatch.accountId,
          });
        }
      });

      if (contactsTags.length) {
        await this.msgopsService.createContactTagBatch(contactsTags);
      }
      return this.processReturn(200, `[Contacts Batch] -  Created contacts batch. Tag: ${contactsBatch.tag}!`);
    } catch (error) {
      console.error(error);
      return this.processReturn(200, `[Contacts Batch] -  Invalid payload: ${JSON.stringify(contactsBatch)}!`);
    }
  }

  async processCompleted(leadMessage: LeadMessage) {
    await this.queuePublisher.publishAnalyticsEvent({
      timestamp: Date.now(),
      event: `automation-${Status.completed}`,
      automationId: leadMessage.automation.id,
      accountId: leadMessage.account.id,
      contactId: leadMessage.contact.id,
      uuid: leadMessage.contact.uuid,
      email: leadMessage.contact.email,
      properties: {
        reason: 'completed',
        automationId: leadMessage.automation.id,
        automationName: leadMessage.automation.name,
      },
    });

    return this.msgopsService.completeAutomations(leadMessage.account.id, leadMessage.id);
  }

  async processSegment(id: number, isCampaign?: boolean) {
    const currentDate = new Date();

    const redisClient = await this.redisService.getOrThrow();
    const redisKey = `processingsegment:${id}`;
    const lockToken = randomUUID();

    // Atomic SET NX EX: replaces the previous non-atomic `set` so concurrent
    // dispatches (BullMQ retry + a fresh schedule, or two workers) can't both
    // enter processSegment. TTL 1900s is above any plausible run duration.
    // On contention we throw 5xx — BullMQ retries the job per the configured
    // backoff and the HTTP entrypoint replies 5xx so the AMQP consumer nacks.
    const acquired = await redisClient.set(redisKey, lockToken, 'EX', 1900, 'NX');
    if (acquired !== 'OK') {
      this.trackerService.logInfo(`[Segment] Lock contention for ${id}; deferring to retry`);
      throw new HttpException(
        { status: HttpStatus.SERVICE_UNAVAILABLE, message: `[Segment] Locked: ${id}` },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let segment: Awaited<ReturnType<typeof this.msgopsService.getTagById>> | null = null;
    let currentTaskId: string | null = null;
    try {
      segment = await this.msgopsService.getTagById(id);
      if (!segment) {
        this.trackerService.logInfo(`[Segment] Segment not found: ${id}`);
        return { status: 200, message: `[Segment] Segment not found: ${id}` };
      }
      currentTaskId = segment.scheduleCloudTaskId;
      const account = await this.msgopsService.findAccount(segment.accountId);
      if (!account) {
        this.trackerService.logInfo(
          `[Segment] Account ${segment.accountId} not found or inactive — skipping segment ${id} and stopping further scheduling`,
        );
        await this.msgopsService.updateTag(segment.id, {
          status: SegmentStatus.INACTIVE,
          scheduleCloudTaskId: null,
        });
        return { status: 200, message: `[Segment] Account inactive for segment: ${id}` };
      }

      segment.segmentInfo = !segment.segmentInfo ? [] : segment.segmentInfo;
      const lastValidDate = dayjs().subtract(7, 'day');
      // Skip auto-deactivation for base-size segments — they don't drive campaigns,
      // so segmentActive() always returns 0 and they'd get wiped on every run.
      if (
        segment.type !== 'segment-base-size' &&
        segment.status !== SegmentStatus.REACTIVATING &&
        dayjs(segment.createdAt) < lastValidDate
      ) {
        const campaignsSchedule = await this.segmentActive(segment.id);
        if (campaignsSchedule == 0) {
          await this.msgopsService.processSegment(segment.id, segment.accountId, null, null);
          await this.msgopsService.updateTag(segment.id, { status: SegmentStatus.INACTIVE, scheduleCloudTaskId: null });
          return { status: 200, message: `[Segment] Segment inactive: ${id}` };
        }
      }

      const accountTimeZone = (account.accountConfigs as Record<string, string>)?.time_zone;
      const generated = generateForSegment(
        { id: segment.id, accountId: segment.accountId },
        {
          steps: typeof segment.steps === 'string' ? JSON.parse(segment.steps) : (segment.steps as unknown as any[][]),
          addBounced: segment.addBounced,
          addUnsubscribed: segment.addUnsubscribed,
          addInvalid: segment.addInvalid,
          contactsLimit: segment.contactsLimit,
        },
        accountTimeZone,
      );
      const query = this.formattedTimeQuery(generated.query);
      const formattedExternalSteps = generated.externalQuerySteps
        ? generated.externalQuerySteps.map(
            (item) =>
              ({
                tableName: item.tableName,
                filterType: item?.filterType || null,
                query: this.formattedTimeQuery(item.query),
              }) as SegmentExternalQueryPayload,
          )
        : null;

      this.trackerService.logInfo(
        `[Segment] generated query - tagId=${segment.id} accountId=${segment.accountId}`,
        JSON.stringify({ query, externalQuerySteps: formattedExternalSteps }),
      );

      const dataInsertAndDelete = await this.msgopsService.processSegment(
        segment.id,
        segment.accountId,
        query,
        formattedExternalSteps,
      );
      const duration = Math.abs(new Date().getTime() - currentDate.getTime());
      const counts = await this.msgopsService.getNumberContactsByTag(segment.accountId, segment.id);

      const hour = Math.floor(Math.random() * (7 - 4 + 1) + 4);
      const minute = Math.floor(Math.random() * 59 + 1);
      const second = Math.floor(Math.random() * 59 + 1);
      const scheduleDate = dayjs()
        .tz(accountTimeZone || 'America/Sao_Paulo')
        .add(1, 'day')
        .set('hour', hour)
        .set('minute', minute)
        .set('second', second);

      if (!isCampaign) {
        const diffMs = scheduleDate.diff(dayjs(), 'millisecond');
        const job = await this.queuePublisher.scheduleSegmentRecalculation(segment.id, diffMs);
        segment.scheduleCloudTaskId = String(job.id);
      }

      segment.lastCount = counts.total;
      segment.lastCountEmail = counts.email;
      segment.lastCountWebPush = counts.web_push;
      segment.lastCountMobilePush = counts.mobile_push;
      segment.lastCountPhone = counts.phone;
      segment.lastCountWhatsapp = counts.whatsapp;
      segment.segmentInfo.push({
        date: currentDate,
        status: true,
        duration: duration,
        count: counts.total,
        insert: dataInsertAndDelete.insertIds ? dataInsertAndDelete.insertIds.length : 0,
        delete: dataInsertAndDelete.deleteIds ? dataInsertAndDelete.deleteIds.length : 0,
        channels: {
          ...counts,
        },
      });

      if (segment.segmentInfo.length > 100) {
        segment.segmentInfo = segment.segmentInfo.slice(-100);
      }

      if (account.isInternal && dataInsertAndDelete.insertIds && dataInsertAndDelete.insertIds.length) {
        const dataInsert = {
          type: 'segment-in',
          tagId: segment.id,
          tagName: segment.name,
          accountId: segment.accountId,
          contacts: dataInsertAndDelete.insertIds,
        };
        await this.queuePublisher.publishSegmentData(dataInsert);
      }

      if (account.isInternal && dataInsertAndDelete.deleteIds && dataInsertAndDelete.deleteIds.length) {
        const dataDelete = {
          type: 'segment-out',
          tagId: segment.id,
          tagName: segment.name,
          accountId: segment.accountId,
          contacts: dataInsertAndDelete.deleteIds,
        };
        await this.queuePublisher.publishSegmentData(dataDelete);
      }

      return await this.msgopsService.updateTag(segment.id, {
        scheduleCloudTaskId: segment.scheduleCloudTaskId,
        lastCount: segment.lastCount,
        lastCountEmail: segment.lastCountEmail,
        lastCountWebPush: segment.lastCountWebPush,
        lastCountMobilePush: segment.lastCountMobilePush,
        lastCountPhone: segment.lastCountPhone,
        lastCountWhatsapp: segment.lastCountWhatsapp,
        segmentInfo: segment.segmentInfo,
        status: SegmentStatus.ACTIVE,
      });
    } catch (error) {
      // If the throw landed before we loaded the segment (e.g. DB error from
      // getTagById), there's no segment_info to update — rethrow and let the
      // finally release the lock.
      if (!segment) {
        this.trackerService.logInfo(`[Segment] Error before segment load: ${id}`, error);
        throw new Error(`[Segment] Error executing segment: ${id}`);
      }

      const duration = Math.abs(new Date().getTime() - currentDate.getTime());
      segment.segmentInfo.push({
        date: currentDate,
        status: false,
        duration,
        count: 0,
      });

      if (currentTaskId !== segment.scheduleCloudTaskId) {
        await this.queuePublisher.cancelSegmentJob(segment.scheduleCloudTaskId);
        this.trackerService.logInfo(`[Segment] Duplicated task deleted: ${segment.scheduleCloudTaskId}`);
        segment.scheduleCloudTaskId = currentTaskId;
      }

      await this.msgopsService.updateTag(segment.id, {
        scheduleCloudTaskId: segment.scheduleCloudTaskId,
        segmentInfo: segment.segmentInfo,
      });

      this.trackerService.logInfo(`[Segment] Error executing segment: ${id}`, error);
      throw new Error(`[Segment] Error executing segment: ${id}`);
    } finally {
      // Compare-and-delete: only release if our token still owns the key.
      // Guards against releasing a lock that's been re-acquired after our TTL
      // expired (e.g. a stuck run that exceeded 1900s).
      await redisClient.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        redisKey,
        lockToken,
      );
    }
  }

  formattedTimeQuery(query: string) {
    const regex = /#REPLACE_TIME_(\d+)_EVENTS_LOGS#/;
    const regexBetween = /#BETWEEN_REPLACE_([a-zA-Z0-9_,]+)_EVENTS_LOGS#/;
    let result = null;
    while ((result = regex.exec(query))) {
      query = query.replace(regex, `'${dayjs().subtract(result[1], 'day').format('YYYY-MM-DD')}'`);
    }

    while ((result = regexBetween.exec(query))) {
      const resultReplace = this.processSegmentBetweenDate(result[1]);
      query = query.replace(regexBetween, ` '${resultReplace.startDate}' AND '${resultReplace.finalDate}'`);
    }

    return query;
  }

  processSegmentBetweenDate(result) {
    const filter = result.split(',');
    const dayFilter = parseInt(filter[1]);
    let startDate = null;
    let finalDate = null;
    if (filter[0] === 'current_week') {
      startDate = dayjs().day(dayFilter);
      if (dayjs().day() < dayFilter) {
        startDate = startDate.subtract(1, 'week');
      }
      const dayFinalDate = dayFilter === 0 ? 6 : dayFilter - 1;
      finalDate = dayjs().day(dayFinalDate);
      if (dayjs().day() >= dayFilter) {
        finalDate = finalDate.add(1, 'week');
      }
    } else {
      const dayFinalDate = dayFilter === 0 ? 6 : dayFilter - 1;
      startDate = dayjs().day(dayFilter);
      finalDate = dayjs().day(dayFinalDate);
      if (dayjs().day() < dayFilter) {
        startDate = startDate.subtract(2, 'week');
        finalDate = finalDate.subtract(1, 'week');
      } else {
        startDate = startDate.subtract(1, 'week');
      }
    }

    return { startDate: startDate.format('YYYY-MM-DD'), finalDate: finalDate.format('YYYY-MM-DD') };
  }

  async processSegmentToClickHouse(segemenData: SegmentToClickHouse) {
    const account = await this.msgopsService.findAccount(segemenData.accountId);
    const contactsArray = segemenData.contacts.map((item) => item.contact_id);
    const contactsSplit = [];

    for (let i = 0; i < contactsArray.length; i += 10000) {
      contactsSplit.push(contactsArray.slice(i, i + 10000));
    }

    let reasons = null;
    const reasonData = {
      unsub_qtd: 0,
      bounce_qtd: 0,
      open_qtd: 0,
      click_qtd: 0,
      in_tag_qtd: 0,
      engagement_qtd: 0,
      invalid_qtd: 0,
    };
    const reasonInData = { bought: 0, reengaged: 0 };
    const segmentDb = await this.msgopsService.getTagById(segemenData.tagId);
    if (
      ['segment-out', 'segment-in'].includes(segemenData.type) &&
      segemenData.tagName.toLowerCase() == '00 - base size'
    ) {
      const concatTableName = segemenData.type == 'segment-out' ? 'out' : 'in';
      const tableName = await this.msgopsService.createSegmentTable(segemenData.tagId, contactsSplit, concatTableName);
      const accountTimeZone = (account.accountConfigs as Record<string, string>).time_zone || 'America/Sao_Paulo';
      if (segemenData.type == 'segment-out') {
        const filters = { open: 30, click: 30, tags: 0 };
        for (const steps of JSON.parse(segmentDb.steps)) {
          for (const card of steps) {
            if (card.type == 'interation' && card.event == 'last_open_date' && card.time) {
              filters.open = card.time;
            }
            if (card.type == 'interation' && card.event == 'last_click_date' && card.time) {
              filters.click = card.time;
            }
            if (card.type == 'tag' && card.tag_id) {
              filters.tags = card.tag_id.join(',');
            }
          }
        }
        reasons = await this.msgopsService.processSegmentOutLogic(
          filters.click,
          filters.open,
          segemenData.accountId,
          segemenData.tagId,
          tableName,
          filters.tags,
          accountTimeZone,
        );
      }

      if (segemenData.type == 'segment-in') {
        const last3Days = dayjs().subtract(3, 'day').tz(accountTimeZone).format('YYYY-MM-DD');
        reasons = await this.msgopsService.processSegmentInLogic(segemenData.accountId, tableName, last3Days);
      }
    }

    for (const contacts of contactsSplit) {
      const contactsUuid = reasons
        ? reasons
        : await this.msgopsService.findContactsUUID(contacts, segemenData.accountId);
      let delay = 0;
      await Promise.all(
        contactsUuid.map(async (contact) => {
          delay += 5;
          if (reasons) {
            if (segemenData.type == 'segment-in') {
              if (contact.bought) {
                reasonInData.bought += 1;
              } else {
                reasonInData.reengaged += 1;
              }
            } else {
              if (contact.bounced) {
                reasonData.bounce_qtd += 1;
              } else if (contact.unsub) {
                reasonData.unsub_qtd += 1;
              } else if (contact.invalid) {
                reasonData.invalid_qtd += 1;
              } else if (contact.in_tag) {
                reasonData.in_tag_qtd += 1;
              } else if (contact.open || contact.click) {
                reasonData.engagement_qtd += 1;
                if (contact.open && !contact.click) {
                  reasonData.open_qtd += 1;
                }
                if (contact.click && !contact.open) {
                  reasonData.click_qtd += 1;
                }
              }
            }
          }
          return new Promise((resolve) => setTimeout(resolve, delay)).then(async () => {
            await this.queuePublisher.publishAnalyticsEvent({
              timestamp: Date.now(),
              event: segemenData.type,
              accountId: account.id,
              contactId: contact.id,
              uuid: contact.uuid,
              email: contact.email,
              properties: {
                location: 'segment',
                segmentId: segemenData.tagId,
                segmentName: segemenData.tagName,
                ...(reasons ? { contact } : {}),
              },
            });
          });
        }),
      );
    }

    if (reasons) {
      const segmentDbInfo = await this.msgopsService.getTagById(segemenData.tagId);
      segmentDbInfo.segmentInfo[segmentDbInfo.segmentInfo.length - 1] = {
        ...segmentDbInfo.segmentInfo[segmentDbInfo.segmentInfo.length - 1],
        ...(segemenData.type == 'segment-out' ? { outInfo: { ...reasonData } } : { inInfo: { ...reasonInData } }),
      };
      await this.msgopsService.updateTag(segmentDbInfo.id, { segmentInfo: segmentDbInfo.segmentInfo });
    }
  }

  async segmentActive(tagId: number) {
    const query = `select count(*) count from campaigns, jsonb_array_elements(tags) 
    where schedule_to >= (CURRENT_DATE - interval '7 day') and value->>'id' = '${tagId}'`;

    const countUse = await this.msgopsService.queryRunner(query);
    return countUse[0]?.count || 0;
  }

  async processEventTrigger(event: EventsTrigger) {
    return this.automationHandler.eventsTrigger(event);
  }

  async targetAchieved(data: { accountId: number; contactId: number; automationId: number }) {
    const account = await this.msgopsService.findAccount(data.accountId);

    if (!account) {
      return { status: false };
    }
    const accountTimeZone = (account.accountConfigs as Record<string, string>).time_zone || 'UTC';
    const currentDate = dayjs().tz(accountTimeZone).format('YYYY-MM-DD');
    const completedAutomations = await this.msgopsService.completeTargetedAutomations(currentDate, data);
    if (completedAutomations.length) {
      const redisKeys = completedAutomations.map(
        (automation) => `automation_target_contact:${automation.contactId}:${automation.id}`,
      );
      const redisClient = await this.redisService.getOrThrow();
      await Promise.all(redisKeys.map((key) => redisClient.set(key, 'true', 'EX', 60 * 60 * 24))); // 24 hours
      const contact = await this.msgopsService.findContactsUUID([data.contactId], data.accountId);
      await this.queuePublisher.publishAnalyticsEvent({
        timestamp: Date.now(),
        event: `automation-${Status.completed}`,
        automationId: data.automationId,
        accountId: account.id,
        properties: {
          reason: 'completed target',
          automationId: data.automationId,
          automationName: completedAutomations[0].automationTitle,
        },
        ...(contact.length
          ? { contactId: contact[0].id, uuid: contact[0].uuid, email: contact[0].email }
          : { contactId: data.contactId }),
      });
    }
  }

  getMailBoxProvider(email: string): string {
    const domain = email.toLowerCase().split('@')[1];

    const gmail = ['gmail.com', 'googlemail.com', 'google.com'];
    if (gmail.includes(domain)) {
      return 'Gmail';
    }

    if (domain.includes('yahoo')) {
      return 'Yahoo';
    }

    const microsoft = ['hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'passport.com'];
    if (microsoft.some((x) => domain.includes(x))) {
      return 'Microsoft';
    }

    const icloud = ['icloud.com', 'me.com', 'mac.com'];
    if (icloud.includes(domain)) {
      return 'iCloud';
    }

    return 'Other';
  }
}
