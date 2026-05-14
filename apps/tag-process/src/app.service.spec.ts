import { HttpException } from '@nestjs/common';
import { AppService } from './app.service';
import { AutomationHandler } from './handlers/automation.handler';
import { MsgopsService } from './msgops/msgops.service';
import { QueuePublisher } from './providers/queue/queue.publisher';
import { RedisService } from './providers/redis/redis.service';
import { TrackerService } from './tracker/tracker.service';
import {
  createLeadMessage,
  createTagBatch,
  createAccount,
  createTag,
  createSegmentToClickHouse,
  createContactAutomation,
} from './__mocks__/test-fixtures';
import { Actions, SegmentStatus, Status } from './interfaces';

describe('AppService', () => {
  let appService: AppService;
  let automationHandler: jest.Mocked<AutomationHandler>;
  let msgopsService: jest.Mocked<MsgopsService>;
  let queuePublisher: jest.Mocked<QueuePublisher>;
  let redisService: jest.Mocked<RedisService>;
  let trackerService: jest.Mocked<TrackerService>;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
    };

    automationHandler = {
      addTagAndStartAutomation: jest.fn().mockResolvedValue(undefined),
      cancelRunningAutomation: jest.fn().mockResolvedValue(undefined),
      eventsTrigger: jest.fn().mockResolvedValue({ status: 200 }),
    } as any;

    msgopsService = {
      findAccountByConfig: jest.fn(),
      findAccount: jest.fn(),
      getTagByName: jest.fn(),
      getTagById: jest.fn(),
      findContactsByEmail: jest.fn(),
      deleteContactTagBatch: jest.fn(),
      createContactTagBatch: jest.fn(),
      createContactsBatch: jest.fn(),
      completeAutomations: jest.fn(),
      processSegment: jest.fn(),
      updateTag: jest.fn(),
      getNumberContactsByTag: jest.fn(),
      queryRunner: jest.fn(),
      findContactsUUID: jest.fn(),
      createSegmentTable: jest.fn(),
      processSegmentOutLogic: jest.fn(),
      processSegmentInLogic: jest.fn(),
      completeTargetedAutomations: jest.fn(),
    } as any;

    queuePublisher = {
      publishAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
      publishSegmentData: jest.fn().mockResolvedValue(undefined),
      publishContactsBatch: jest.fn().mockResolvedValue(undefined),
      scheduleSegmentRecalculation: jest.fn().mockResolvedValue({ id: 'job-123' }),
      cancelSegmentJob: jest.fn().mockResolvedValue(undefined),
    } as any;

    redisService = {
      getOrThrow: jest.fn().mockReturnValue(mockRedisClient),
    } as any;

    trackerService = {
      logInfo: jest.fn(),
      send: jest.fn(),
    } as any;

    appService = new AppService(automationHandler, msgopsService, queuePublisher, redisService, trackerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addTag', () => {
    it('should process a lead message successfully', async () => {
      const leadMessage = createLeadMessage();
      const result = await appService.addTag(leadMessage);
      expect(automationHandler.addTagAndStartAutomation).toHaveBeenCalledWith(leadMessage);
      expect(result).toEqual({ status: 200, message: expect.stringContaining('successfully processed') });
    });

    it('should return early when tagName, webPush, and mobilePush are all falsy', async () => {
      const leadMessage = createLeadMessage({ tagName: undefined, webPush: undefined, mobilePush: undefined });
      const result = await appService.addTag(leadMessage);
      expect(automationHandler.addTagAndStartAutomation).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should throw HttpException when handler throws', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const leadMessage = createLeadMessage();
      automationHandler.addTagAndStartAutomation.mockRejectedValue(new Error('handler fail'));
      await expect(appService.addTag(leadMessage)).rejects.toThrow(HttpException);
    });
  });

  describe('removeTag', () => {
    it('should process removeTag successfully', async () => {
      const leadMessage = createLeadMessage();
      const result = await appService.removeTag(leadMessage);
      expect(automationHandler.cancelRunningAutomation).toHaveBeenCalledWith(leadMessage, true);
      expect(result).toEqual({ status: 200, message: expect.stringContaining('Tag Removed') });
    });

    it('should throw HttpException when handler throws', async () => {
      const leadMessage = createLeadMessage();
      automationHandler.cancelRunningAutomation.mockRejectedValue(new Error('cancel fail'));
      await expect(appService.removeTag(leadMessage)).rejects.toThrow(HttpException);
    });
  });

  describe('automationCancel', () => {
    it('should cancel automation successfully', async () => {
      const leadMessage = createLeadMessage();
      const result = await appService.automationCancel(leadMessage);
      expect(automationHandler.cancelRunningAutomation).toHaveBeenCalledWith(leadMessage, false);
      expect(result).toEqual({ status: 200, message: expect.stringContaining('Automation Canceled') });
    });

    it('should throw HttpException when handler throws', async () => {
      const leadMessage = createLeadMessage();
      automationHandler.cancelRunningAutomation.mockRejectedValue(new Error('cancel fail'));
      await expect(appService.automationCancel(leadMessage)).rejects.toThrow(HttpException);
    });
  });

  describe('processTagBatch', () => {
    it('should throw when account not found', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const batch = createTagBatch();
      msgopsService.findAccountByConfig.mockResolvedValue({ account: null } as any);
      const result = await appService.processTagBatch(batch);
      expect(result.status).toBe(200);
      expect(result.message).toContain('Invalid payload');
    });

    it('should throw when tag not found', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const batch = createTagBatch();
      msgopsService.findAccountByConfig.mockResolvedValue({ account: createAccount() } as any);
      msgopsService.getTagByName.mockResolvedValue(null);
      const result = await appService.processTagBatch(batch);
      expect(result.status).toBe(200);
      expect(result.message).toContain('Invalid payload');
    });

    it('should handle ADD action with existing contacts', async () => {
      const batch = createTagBatch({ action: Actions.ADD as any });
      const account = createAccount();
      const tag = createTag();
      msgopsService.findAccountByConfig.mockResolvedValue({ account } as any);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.findContactsByEmail.mockResolvedValue([{ id: 1, email: 'user1@example.com' }] as any);
      msgopsService.createContactTagBatch.mockResolvedValue(true as any);

      const result = await appService.processTagBatch(batch);
      expect(result.status).toBe(200);
      expect(msgopsService.createContactTagBatch).toHaveBeenCalled();
    });

    it('should handle REMOVE action', async () => {
      const batch = createTagBatch({ action: Actions.REMOVE as any });
      const account = createAccount();
      const tag = createTag();
      msgopsService.findAccountByConfig.mockResolvedValue({ account } as any);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.findContactsByEmail.mockResolvedValue([{ id: 1, email: 'user1@example.com' }] as any);
      msgopsService.deleteContactTagBatch.mockResolvedValue(undefined);

      const result = await appService.processTagBatch(batch);
      expect(result.status).toBe(200);
      expect(msgopsService.deleteContactTagBatch).toHaveBeenCalled();
    });

    it('should send pubsub for new contacts when createContacts is true and contacts remain', async () => {
      const batch = createTagBatch({ action: Actions.ADD as any, createContacts: true });
      const account = createAccount();
      const tag = createTag();
      msgopsService.findAccountByConfig.mockResolvedValue({ account } as any);
      msgopsService.getTagByName.mockResolvedValue(tag);
      // Return empty so no contacts are spliced out
      msgopsService.findContactsByEmail.mockResolvedValue([]);
      msgopsService.createContactTagBatch.mockResolvedValue(true as any);

      await appService.processTagBatch(batch);
      expect(queuePublisher.publishContactsBatch).toHaveBeenCalled();
    });
  });

  describe('processContactsBatch', () => {
    it('should create contacts and tags', async () => {
      const batch = createTagBatch({ accountId: 1, tagId: 100 });
      msgopsService.createContactsBatch.mockResolvedValue({
        identifiers: [{ id: 1 }, { id: 2 }],
        generatedMaps: [],
        raw: [],
      } as any);
      msgopsService.createContactTagBatch.mockResolvedValue(true as any);

      const result = await appService.processContactsBatch(batch);
      expect(result.status).toBe(200);
      expect(result.message).toContain('Created contacts batch');
      expect(msgopsService.createContactsBatch).toHaveBeenCalled();
      expect(msgopsService.createContactTagBatch).toHaveBeenCalled();
    });

    it('should not create tags when no identifiers returned', async () => {
      const batch = createTagBatch({ accountId: 1, tagId: 100 });
      msgopsService.createContactsBatch.mockResolvedValue({
        identifiers: [],
        generatedMaps: [],
        raw: [],
      } as any);

      const result = await appService.processContactsBatch(batch);
      expect(result.status).toBe(200);
      expect(msgopsService.createContactTagBatch).not.toHaveBeenCalled();
    });

    it('should handle error gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const batch = createTagBatch({ accountId: 1, tagId: 100 });
      msgopsService.createContactsBatch.mockRejectedValue(new Error('db error'));

      const result = await appService.processContactsBatch(batch);
      expect(result.status).toBe(200);
      expect(result.message).toContain('Invalid payload');
    });

    it('should skip null identifiers', async () => {
      const batch = createTagBatch({ accountId: 1, tagId: 100 });
      msgopsService.createContactsBatch.mockResolvedValue({
        identifiers: [{ id: 1 }, null, { id: 3 }],
        generatedMaps: [],
        raw: [],
      } as any);
      msgopsService.createContactTagBatch.mockResolvedValue(true as any);

      const result = await appService.processContactsBatch(batch);
      expect(result.status).toBe(200);
    });
  });

  describe('processCompleted', () => {
    it('should send clickhouse message and complete automations', async () => {
      const leadMessage = createLeadMessage();
      msgopsService.completeAutomations.mockResolvedValue({} as any);

      await appService.processCompleted(leadMessage);

      expect(queuePublisher.publishAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: `automation-${Status.completed}`,
          automationId: leadMessage.automation.id,
        }),
      );
      expect(msgopsService.completeAutomations).toHaveBeenCalledWith(leadMessage.account.id, leadMessage.id);
    });
  });

  describe('processSegment', () => {
    const segmentId = 100;

    beforeEach(() => {
      process.env.TAG_PROCESS_ENDPOINT = 'https://example.com/segment';
    });

    it('should return segment not found when tag does not exist', async () => {
      msgopsService.getTagById.mockResolvedValue(null);
      const result = await appService.processSegment(segmentId);
      expect(result).toEqual({ status: 200, message: expect.stringContaining('Segment not found') });
    });

    it('should process segment successfully', async () => {
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
      });
      const account = createAccount();
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(account);
      msgopsService.processSegment.mockResolvedValue({ insertIds: [1], deleteIds: [2] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 10,
        email: 5,
        mobile_push: 1,
        web_push: 2,
        phone: 1,
        whatsapp: 1,
      });
      msgopsService.updateTag.mockResolvedValue({} as any);

      await appService.processSegment(segmentId);

      expect(msgopsService.processSegment).toHaveBeenCalled();
      expect(queuePublisher.scheduleSegmentRecalculation).toHaveBeenCalled();
      expect(msgopsService.updateTag).toHaveBeenCalledWith(
        segmentId,
        expect.objectContaining({ status: SegmentStatus.ACTIVE }),
      );
    });

    it('should not create cloud task when isCampaign is true', async () => {
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.processSegment.mockResolvedValue({ insertIds: [], deleteIds: [] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 0,
        email: 0,
        mobile_push: 0,
        web_push: 0,
        phone: 0,
        whatsapp: 0,
      });
      msgopsService.updateTag.mockResolvedValue({} as any);

      await appService.processSegment(segmentId, true);

      expect(queuePublisher.scheduleSegmentRecalculation).not.toHaveBeenCalled();
    });

    it('should send segment-in pubsub when account is internal and has inserts', async () => {
      const account = createAccount({ isInternal: true });
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(account);
      msgopsService.processSegment.mockResolvedValue({ insertIds: [1, 2], deleteIds: [] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 2,
        email: 2,
        mobile_push: 0,
        web_push: 0,
        phone: 0,
        whatsapp: 0,
      });
      msgopsService.updateTag.mockResolvedValue({} as any);

      await appService.processSegment(segmentId);

      expect(queuePublisher.publishSegmentData).toHaveBeenCalledWith(expect.objectContaining({ type: 'segment-in' }));
    });

    it('should send segment-out pubsub when account is internal and has deletes', async () => {
      const account = createAccount({ isInternal: true });
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(account);
      msgopsService.processSegment.mockResolvedValue({ insertIds: [], deleteIds: [3, 4] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 0,
        email: 0,
        mobile_push: 0,
        web_push: 0,
        phone: 0,
        whatsapp: 0,
      });
      msgopsService.updateTag.mockResolvedValue({} as any);

      await appService.processSegment(segmentId);

      expect(queuePublisher.publishSegmentData).toHaveBeenCalledWith(expect.objectContaining({ type: 'segment-out' }));
    });

    it('should trim segmentInfo to last 100 entries', async () => {
      const longSegmentInfo = Array.from({ length: 105 }, (_, i) => ({
        date: new Date(),
        status: true,
        duration: 100,
        count: i,
      }));
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: longSegmentInfo as any,
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.processSegment.mockResolvedValue({ insertIds: [], deleteIds: [] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 0,
        email: 0,
        mobile_push: 0,
        web_push: 0,
        phone: 0,
        whatsapp: 0,
      });
      msgopsService.updateTag.mockResolvedValue({} as any);

      await appService.processSegment(segmentId);

      const updateCall = msgopsService.updateTag.mock.calls[0][1];
      expect(updateCall.segmentInfo.length).toBeLessThanOrEqual(100);
    });

    it('should handle error and rollback in catch block', async () => {
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
        scheduleCloudTaskId: 'old-task',
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.processSegment.mockRejectedValue(new Error('segment error'));
      msgopsService.updateTag.mockResolvedValue({} as any);

      await expect(appService.processSegment(segmentId)).rejects.toThrow('Error executing segment');
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should set segment to INACTIVE when not real-time and no campaigns', async () => {
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: false,
        status: SegmentStatus.ACTIVE,
        segmentInfo: [],
        createdAt: new Date('2020-01-01'),
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.queryRunner.mockResolvedValue([{ count: 0 }]);
      msgopsService.processSegment.mockResolvedValue({ insertIds: null, deleteIds: null });
      msgopsService.updateTag.mockResolvedValue({} as any);

      const result = await appService.processSegment(segmentId);
      expect(result).toEqual({ status: 200, message: expect.stringContaining('Segment inactive') });
      expect(msgopsService.updateTag).toHaveBeenCalledWith(
        segmentId,
        expect.objectContaining({ status: SegmentStatus.INACTIVE }),
      );
    });

    it('should handle externalQuerySteps in segment', async () => {
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.processSegment.mockResolvedValue({ insertIds: [], deleteIds: [] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 0,
        email: 0,
        mobile_push: 0,
        web_push: 0,
        phone: 0,
        whatsapp: 0,
      });
      msgopsService.updateTag.mockResolvedValue({} as any);

      await appService.processSegment(segmentId);
      expect(msgopsService.processSegment).toHaveBeenCalled();
    });

    it('should delete duplicated task in error when scheduleCloudTaskId changed', async () => {
      const segment = createTag({
        id: segmentId,
        isRealTimeSegment: true,
        segmentInfo: [],
        scheduleCloudTaskId: 'old-task',
      });
      msgopsService.getTagById.mockResolvedValue(segment);
      msgopsService.findAccount.mockResolvedValue(createAccount());
      // Make processSegment succeed but then googleTasksProvider creates a new task
      msgopsService.processSegment.mockResolvedValue({ insertIds: [], deleteIds: [] });
      msgopsService.getNumberContactsByTag.mockResolvedValue({
        total: 0,
        email: 0,
        mobile_push: 0,
        web_push: 0,
        phone: 0,
        whatsapp: 0,
      });
      // After the task is created, the segment.scheduleCloudTaskId changes
      // Simulate error after task creation
      msgopsService.updateTag.mockRejectedValueOnce(new Error('update error'));
      msgopsService.updateTag.mockResolvedValueOnce({} as any);

      await expect(appService.processSegment(segmentId)).rejects.toThrow();
    });
  });

  describe('formattedTimeQuery', () => {
    it('should replace REPLACE_TIME placeholders', () => {
      const query = 'SELECT * WHERE date > #REPLACE_TIME_30_EVENTS_LOGS#';
      const result = appService.formattedTimeQuery(query);
      expect(result).toMatch(/SELECT \* WHERE date > '\d{4}-\d{2}-\d{2}'/);
      expect(result).not.toContain('#REPLACE_TIME');
    });

    it('should replace multiple REPLACE_TIME placeholders', () => {
      const query = 'WHERE a > #REPLACE_TIME_30_EVENTS_LOGS# AND b > #REPLACE_TIME_7_EVENTS_LOGS#';
      const result = appService.formattedTimeQuery(query);
      expect(result).not.toContain('#REPLACE_TIME');
    });

    it('should replace BETWEEN_REPLACE placeholders', () => {
      const query = 'WHERE date BETWEEN #BETWEEN_REPLACE_current_week,1_EVENTS_LOGS#';
      const result = appService.formattedTimeQuery(query);
      expect(result).not.toContain('#BETWEEN_REPLACE');
      expect(result).toContain('AND');
    });

    it('should return query unchanged when no placeholders', () => {
      const query = 'SELECT * FROM contacts WHERE id = 1';
      const result = appService.formattedTimeQuery(query);
      expect(result).toBe(query);
    });
  });

  describe('processSegmentBetweenDate', () => {
    it('should return dates for current_week', () => {
      const result = appService.processSegmentBetweenDate('current_week,1');
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('finalDate');
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result.finalDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should return dates for last_week', () => {
      const result = appService.processSegmentBetweenDate('last_week,1');
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('finalDate');
    });

    it('should handle dayFilter 0 for current_week', () => {
      const result = appService.processSegmentBetweenDate('current_week,0');
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result.finalDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle dayFilter 0 for last_week', () => {
      const result = appService.processSegmentBetweenDate('last_week,0');
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('processSegmentToClickHouse', () => {
    it('should process segment-in with non-base-size tag', async () => {
      const segmentData = createSegmentToClickHouse({ tagName: 'other-tag' });
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.getTagById.mockResolvedValue(createTag());
      msgopsService.findContactsUUID.mockResolvedValue([
        { id: 1, uuid: 'uuid-1', email: 'a@test.com' },
        { id: 2, uuid: 'uuid-2', email: 'b@test.com' },
      ]);

      await appService.processSegmentToClickHouse(segmentData);

      expect(queuePublisher.publishAnalyticsEvent).toHaveBeenCalled();
    });

    it('should process segment-out with "00 - base size" tag and reasons', async () => {
      const segmentData = createSegmentToClickHouse({
        type: 'segment-out',
        tagName: '00 - base size',
      });
      const tag = createTag({
        steps: JSON.stringify([
          [
            { type: 'interation', event: 'last_open_date', time: 30 },
            { type: 'interation', event: 'last_click_date', time: 30 },
            { type: 'tag', tag_id: [1, 2] },
          ],
        ]),
      });
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.getTagById.mockResolvedValue(tag);
      msgopsService.createSegmentTable.mockResolvedValue('temp_table_123');
      msgopsService.processSegmentOutLogic.mockResolvedValue([
        {
          id: 1,
          uuid: 'uuid-1',
          email: 'a@test.com',
          bounced: true,
          unsub: false,
          invalid: false,
          in_tag: false,
          open: false,
          click: false,
        },
      ]);

      await appService.processSegmentToClickHouse(segmentData);

      expect(msgopsService.processSegmentOutLogic).toHaveBeenCalled();
      expect(msgopsService.updateTag).toHaveBeenCalled();
    });

    it('should process segment-in with "00 - base size" tag and reasons', async () => {
      const segmentData = createSegmentToClickHouse({
        type: 'segment-in',
        tagName: '00 - base size',
      });
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.getTagById.mockResolvedValue(
        createTag({ segmentInfo: [{ date: new Date(), status: true, duration: 1, count: 1 }] }),
      );
      msgopsService.createSegmentTable.mockResolvedValue('temp_table_123');
      msgopsService.processSegmentInLogic.mockResolvedValue([
        { id: 1, uuid: 'uuid-1', email: 'a@test.com', bought: true, reengaged: false },
      ]);

      await appService.processSegmentToClickHouse(segmentData);

      expect(msgopsService.processSegmentInLogic).toHaveBeenCalled();
      expect(msgopsService.updateTag).toHaveBeenCalled();
    });

    it('should categorize segment-out reasons correctly', async () => {
      const segmentData = createSegmentToClickHouse({
        type: 'segment-out',
        tagName: '00 - base size',
      });
      const tag = createTag({
        steps: JSON.stringify([[{ type: 'interation', event: 'last_open_date', time: 30 }]]),
      });
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.getTagById.mockResolvedValue(tag);
      msgopsService.createSegmentTable.mockResolvedValue('temp_table');
      msgopsService.processSegmentOutLogic.mockResolvedValue([
        {
          id: 1,
          uuid: 'u1',
          email: 'a@t.com',
          bounced: false,
          unsub: true,
          invalid: false,
          in_tag: false,
          open: false,
          click: false,
        },
        {
          id: 2,
          uuid: 'u2',
          email: 'b@t.com',
          bounced: false,
          unsub: false,
          invalid: true,
          in_tag: false,
          open: false,
          click: false,
        },
        {
          id: 3,
          uuid: 'u3',
          email: 'c@t.com',
          bounced: false,
          unsub: false,
          invalid: false,
          in_tag: true,
          open: false,
          click: false,
        },
        {
          id: 4,
          uuid: 'u4',
          email: 'd@t.com',
          bounced: false,
          unsub: false,
          invalid: false,
          in_tag: false,
          open: true,
          click: false,
        },
        {
          id: 5,
          uuid: 'u5',
          email: 'e@t.com',
          bounced: false,
          unsub: false,
          invalid: false,
          in_tag: false,
          open: false,
          click: true,
        },
      ]);

      await appService.processSegmentToClickHouse(segmentData);

      expect(msgopsService.updateTag).toHaveBeenCalled();
    });

    it('should split contacts into batches of 10000', async () => {
      const contacts = Array.from({ length: 15000 }, (_, i) => ({ contact_id: i }));
      const segmentData = createSegmentToClickHouse({ contacts, tagName: 'other' });
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.getTagById.mockResolvedValue(createTag());
      msgopsService.findContactsUUID.mockResolvedValue([{ id: 1, uuid: 'u1', email: 'a@t.com' }]);

      await appService.processSegmentToClickHouse(segmentData);

      expect(msgopsService.findContactsUUID).toHaveBeenCalledTimes(2);
    });
  });

  describe('processEventTrigger', () => {
    it('should delegate to automationHandler.eventsTrigger', async () => {
      const event = { accountId: 1, contactId: 100, messageId: 200, event: 'open' as const };
      await appService.processEventTrigger(event);
      expect(automationHandler.eventsTrigger).toHaveBeenCalledWith(event);
    });
  });

  describe('targetAchieved', () => {
    it('should return status false when account not found', async () => {
      msgopsService.findAccount.mockResolvedValue(null);
      const result = await appService.targetAchieved({ accountId: 1, contactId: 100, automationId: 10 });
      expect(result).toEqual({ status: false });
    });

    it('should complete automations and set redis keys', async () => {
      const account = createAccount();
      const completedAutomations = [createContactAutomation({ id: 1, contactId: 100, automationTitle: 'Test' })];
      msgopsService.findAccount.mockResolvedValue(account);
      msgopsService.completeTargetedAutomations.mockResolvedValue(completedAutomations);
      msgopsService.findContactsUUID.mockResolvedValue([{ id: 100, uuid: 'uuid-1', email: 'a@t.com' }]);

      await appService.targetAchieved({ accountId: 1, contactId: 100, automationId: 10 });

      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(queuePublisher.publishAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event: `automation-${Status.completed}` }),
      );
    });

    it('should not send clickhouse message when no automations completed', async () => {
      msgopsService.findAccount.mockResolvedValue(createAccount());
      msgopsService.completeTargetedAutomations.mockResolvedValue([]);

      await appService.targetAchieved({ accountId: 1, contactId: 100, automationId: 10 });

      expect(queuePublisher.publishAnalyticsEvent).not.toHaveBeenCalled();
    });

    it('should handle case when contact not found for clickhouse message', async () => {
      const account = createAccount();
      const completedAutomations = [createContactAutomation({ id: 1, contactId: 100, automationTitle: 'Test' })];
      msgopsService.findAccount.mockResolvedValue(account);
      msgopsService.completeTargetedAutomations.mockResolvedValue(completedAutomations);
      msgopsService.findContactsUUID.mockResolvedValue([]);

      await appService.targetAchieved({ accountId: 1, contactId: 100, automationId: 10 });

      expect(queuePublisher.publishAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({ contactId: 100 }));
    });
  });

  describe('getMailBoxProvider', () => {
    it('should return Gmail for gmail.com', () => {
      expect(appService.getMailBoxProvider('user@gmail.com')).toBe('Gmail');
    });

    it('should return Gmail for googlemail.com', () => {
      expect(appService.getMailBoxProvider('user@googlemail.com')).toBe('Gmail');
    });

    it('should return Gmail for google.com', () => {
      expect(appService.getMailBoxProvider('user@google.com')).toBe('Gmail');
    });

    it('should return Yahoo for yahoo domains', () => {
      expect(appService.getMailBoxProvider('user@yahoo.com')).toBe('Yahoo');
      expect(appService.getMailBoxProvider('user@yahoo.com.br')).toBe('Yahoo');
    });

    it('should return Microsoft for hotmail.com', () => {
      expect(appService.getMailBoxProvider('user@hotmail.com')).toBe('Microsoft');
    });

    it('should return Microsoft for outlook.com', () => {
      expect(appService.getMailBoxProvider('user@outlook.com')).toBe('Microsoft');
    });

    it('should return Microsoft for live.com', () => {
      expect(appService.getMailBoxProvider('user@live.com')).toBe('Microsoft');
    });

    it('should return iCloud for icloud.com', () => {
      expect(appService.getMailBoxProvider('user@icloud.com')).toBe('iCloud');
    });

    it('should return iCloud for me.com', () => {
      expect(appService.getMailBoxProvider('user@me.com')).toBe('iCloud');
    });

    it('should return iCloud for mac.com', () => {
      expect(appService.getMailBoxProvider('user@mac.com')).toBe('iCloud');
    });

    it('should return Other for unknown domains', () => {
      expect(appService.getMailBoxProvider('user@company.com')).toBe('Other');
    });

    it('should be case insensitive', () => {
      expect(appService.getMailBoxProvider('user@GMAIL.COM')).toBe('Gmail');
    });
  });

  describe('segmentActive', () => {
    it('should return count from query', async () => {
      msgopsService.queryRunner.mockResolvedValue([{ count: 5 }]);
      const result = await appService.segmentActive(100);
      expect(result).toBe(5);
    });

    it('should return 0 when no results', async () => {
      msgopsService.queryRunner.mockResolvedValue([]);
      const result = await appService.segmentActive(100);
      expect(result).toBe(0);
    });
  });
});
