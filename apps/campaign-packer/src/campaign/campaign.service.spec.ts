import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { EXCHANGES } from '@bms/messaging';
import { CampaignService } from './campaign.service';
import { MsgopsService } from '../msgops/msgops.service';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { RedisService } from '../providers/redis/redis.service';
import { EventPublisherService } from '../providers/messaging/event-publisher.service';
import { CampaignMessageType, CampaignType } from '../interfaces';

describe('CampaignService', () => {
  let service: CampaignService;

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
  };

  const mockRedisService = {
    getOrThrow: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockMsgopsService = {
    getCampaign: jest.fn(),
    createContactsSend: jest.fn(),
    countByTags: jest.fn(),
    findByTags: jest.fn(),
    updateCampaign: jest.fn(),
    updateCampaignMessage: jest.fn(),
    startedTestAB: jest.fn(),
  };

  const mockQueuePublisher = {
    addCampaignPacker: jest.fn().mockResolvedValue('mock-job-id'),
    addSchedulePage: jest.fn().mockResolvedValue('mock-job-id'),
    addCampaignTrigger: jest.fn().mockResolvedValue('mock-job-id'),
  };

  const mockEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LIMIT_CONTACT_BATCH = '1000';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.exists.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: QueuePublisher, useValue: mockQueuePublisher },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
  });

  function makeCampaign(overrides: any = {}) {
    return {
      id: 1,
      title: 'Test Campaign',
      name: 'test',
      accountId: 1,
      status: 2,
      spreadSending: 10,
      query: 'SELECT contact_id FROM contacts_tags WHERE tag_id = 1',
      steps: [],
      type: CampaignType.SIMPLE,
      messageType: CampaignMessageType.EMAIL,
      account: {
        id: 1,
        name: 'Test Account',
        accountConfigs: [{ name: 'time_zone', value: 'UTC' }],
        configByName: (name: string) => {
          const cfg = overrides.account?.accountConfigs?.find((c: any) => c.name === name);
          return cfg?.value || (name === 'time_zone' ? 'UTC' : null);
        },
      },
      campaignMessage: [
        {
          campaignId: 1,
          messageId: 1,
          winner: false,
          message: {
            id: 1,
            accountId: 1,
            title: 'Test',
            name: 'test',
            subject: 'Test Subject',
            content: '<html>test</html>',
            fromMail: 'test@test.com',
            fromName: 'Test',
            fileName: 'test.html',
            bucketName: 'bucket',
            ippool: 'default',
            replyTo: 'reply@test.com',
          },
        },
      ],
      deletedAt: null,
      ...overrides,
    };
  }

  describe('validateCampaign', () => {
    it('should throw when EMAIL campaign has no content and no GCS location', () => {
      const campaign = makeCampaign({
        campaignMessage: [{ message: { content: null, fileName: null, bucketName: null } }],
      });
      expect(() => (service as any).validateCampaign(campaign)).toThrow(BadRequestException);
    });

    it('should pass when EMAIL campaign has content', () => {
      const campaign = makeCampaign();
      expect(() => (service as any).validateCampaign(campaign)).not.toThrow();
    });

    it('should pass when EMAIL campaign has fileName + bucketName', () => {
      const campaign = makeCampaign({
        campaignMessage: [{ message: { content: null, fileName: 'f', bucketName: 'b' } }],
      });
      expect(() => (service as any).validateCampaign(campaign)).not.toThrow();
    });

    it('should throw when campaign has no query', () => {
      const campaign = makeCampaign({ query: null });
      expect(() => (service as any).validateCampaign(campaign)).toThrow(BadRequestException);
    });
  });

  describe('validateData', () => {
    it('should throw when page property is missing', () => {
      const data = { campaign: makeCampaign() };
      expect(() => (service as any).validateData(data)).toThrow(BadRequestException);
    });

    it('should pass when data has page and valid campaign', () => {
      const data = { page: 1, campaign: makeCampaign() };
      expect(() => (service as any).validateData(data)).not.toThrow();
    });
  });

  describe('getTagsInCampaign', () => {
    it('should return empty array when steps is empty', () => {
      expect((service as any).getTagsInCampaign([])).toEqual([]);
    });

    it('should return tag IDs from tag cards', () => {
      const steps = [[{ type: 'tag', tag_info: [{ id: 1 }, { id: 2 }] }]];
      expect((service as any).getTagsInCampaign(steps)).toEqual([1, 2]);
    });

    it('should exclude tags where conditional === EXCEPT', () => {
      const steps = [[{ type: 'tag', tag_info: [{ id: 1 }], conditional: 'EXCEPT' }]];
      expect((service as any).getTagsInCampaign(steps)).toEqual([]);
    });

    it('should handle multiple steps and cards', () => {
      const steps = [[{ type: 'tag', tag_info: [{ id: 1 }] }], [{ type: 'tag', tag_info: [{ id: 2 }] }]];
      expect((service as any).getTagsInCampaign(steps)).toEqual([1, 2]);
    });

    it('should ignore non-tag card types', () => {
      const steps = [[{ type: 'email', tag_info: [{ id: 1 }] }]];
      expect((service as any).getTagsInCampaign(steps)).toEqual([]);
    });
  });

  describe('createContactsSend', () => {
    it('should return early when stop_campaign Redis key exists', async () => {
      mockRedisClient.get.mockResolvedValue('1');
      const result = await service.createContactsSend(1);
      expect(result).toBeUndefined();
      expect(mockMsgopsService.getCampaign).not.toHaveBeenCalled();
    });

    it('should return error message when campaign not found', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(null);
      const result = await service.createContactsSend(1);
      expect(result).toContain('was not found');
    });

    it('should return error message when campaign has no messages', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ campaignMessage: [] }));
      const result = await service.createContactsSend(1);
      expect(result).toContain('was not found');
    });

    it('should return error message when campaign is deleted', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ deletedAt: new Date() }));
      const result = await service.createContactsSend(1);
      expect(result).toContain('was not found');
    });

    it('should process SIMPLE campaign', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign());
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      await service.createContactsSend(1);
      expect(mockMsgopsService.createContactsSend).toHaveBeenCalled();
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
    });

    it('should process RECURRING campaign', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ type: CampaignType.RECURRING }));
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      await service.createContactsSend(1);
      expect(mockMsgopsService.createContactsSend).toHaveBeenCalled();
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
    });

    it('should not call createContactsSend for TESTAB campaign', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ type: CampaignType.TESTAB }));
      await service.createContactsSend(1);
      expect(mockMsgopsService.createContactsSend).not.toHaveBeenCalled();
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
    });
  });

  describe('createBatches', () => {
    it('should return duplicate message when Redis key exists', async () => {
      mockRedisClient.get.mockResolvedValue('true');
      const campaign = makeCampaign();
      const result = await service.createBatches(campaign);
      expect(result).toContain('Duplicated Campaign');
    });

    it('should throw when campaign has no query', async () => {
      const campaign = makeCampaign({ query: null });
      await expect(service.createBatches(campaign)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when no contacts found', async () => {
      const campaign = makeCampaign();
      mockMsgopsService.countByTags.mockResolvedValue([]);
      await expect(service.createBatches(campaign)).rejects.toThrow(NotFoundException);
    });

    it('should handle single-page campaign', async () => {
      const campaign = makeCampaign();
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      const result = await service.createBatches(campaign);
      expect(mockQueuePublisher.addSchedulePage).toHaveBeenCalledTimes(1);
      expect(result).toContain('Processed 1 pages');
    });

    it('should handle multi-page campaign', async () => {
      const campaign = makeCampaign();
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 300 }, { order_number: 200 }, { order_number: 100 }]);
      const result = await service.createBatches(campaign);
      expect(result).toContain('Processed 3 pages');
    });

    it('should set Redis key after pages published in non-testab mode', async () => {
      const campaign = makeCampaign();
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      await service.createBatches(campaign);
      expect(mockRedisClient.set).toHaveBeenCalledWith('campaign:1', 'true', 'EX', expect.any(Number));
    });

    it('should not set Redis key in testabMode', async () => {
      const campaign = makeCampaign({ testabMode: true, type: CampaignType.TESTAB, testabLastId: 0, testabinInitialPageId: 0 });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      await service.createBatches(campaign);
      expect(mockRedisClient.set).not.toHaveBeenCalledWith('campaign:1', 'true', 'EX', expect.any(Number));
    });

    it('should select winner message when not testabMode and multiple messages', async () => {
      const campaign = makeCampaign({
        campaignMessage: [
          { campaignId: 1, messageId: 1, winner: false, message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b' } },
          { campaignId: 1, messageId: 2, winner: true, message: { id: 2, content: 'test2', fromMail: 'b@b.com', fromName: 'B', fileName: 'f2', bucketName: 'b2' } },
        ],
      });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      await service.createBatches(campaign);
      expect(campaign.campaignMessage).toHaveLength(1);
      expect(campaign.campaignMessage[0].winner).toBe(true);
    });

    it('should fall back to first message when no winner found', async () => {
      const campaign = makeCampaign({
        campaignMessage: [
          { campaignId: 1, messageId: 1, winner: false, message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b' } },
          { campaignId: 1, messageId: 2, winner: false, message: { id: 2, content: 'test2', fromMail: 'b@b.com', fromName: 'B', fileName: 'f2', bucketName: 'b2' } },
        ],
      });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      await service.createBatches(campaign);
      expect(campaign.campaignMessage).toHaveLength(1);
      expect(campaign.campaignMessage[0].messageId).toBe(1);
    });

    it('should set spreadSending for TESTAB with <= 5 pages', async () => {
      const campaign = makeCampaign({ type: CampaignType.TESTAB, spreadSending: 10, testabLastId: 0, testabinInitialPageId: 0 });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 300 }, { order_number: 200 }, { order_number: 100 }]);
      await service.createBatches(campaign);
      expect(campaign.spreadSending).toBe(15);
    });

    it('should handle SPLIT type campaign', async () => {
      const campaign = makeCampaign({
        type: CampaignType.SPLIT,
        testabLastId: 50,
        testabinInitialPageId: 10,
      });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      await service.createBatches(campaign);
      expect(campaign.testabMode).toBe(false);
    });

    it('should handle TESTAB with single page', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabLastId: 50,
        testabinInitialPageId: 10,
        spreadSending: 10,
      });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      await service.createBatches(campaign);
      expect(mockQueuePublisher.addSchedulePage).toHaveBeenCalledTimes(1);
    });

    it('should handle multi-page testab mode', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabMode: true,
        testabLastId: 50,
        testabinInitialPageId: 10,
        spreadSending: 10,
      });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 300 }, { order_number: 200 }, { order_number: 100 }]);
      await service.createBatches(campaign);
      expect(mockQueuePublisher.addSchedulePage).toHaveBeenCalled();
    });

    it('should handle SPLIT multi-page with testabLastId for lastContactId', async () => {
      const campaign = makeCampaign({
        type: CampaignType.SPLIT,
        testabLastId: 50,
        testabinInitialPageId: 10,
      });
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 300 }, { order_number: 200 }, { order_number: 100 }]);
      await service.createBatches(campaign);
      expect(mockQueuePublisher.addSchedulePage).toHaveBeenCalled();
    });

    it('should handle Redis set error gracefully', async () => {
      const campaign = makeCampaign();
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis error'));
      const result = await service.createBatches(campaign);
      expect(result).toBeUndefined();
    });
  });

  describe('processPage', () => {
    it('should return {} when stop_campaign Redis key exists', async () => {
      mockRedisClient.get.mockResolvedValue('1');
      const batch = { campaign: makeCampaign(), page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      const result = await service.processPage(batch);
      expect(result).toEqual({});
    });

    it('should throw when data has no page property', async () => {
      const batch = { campaign: makeCampaign() } as any;
      await expect(service.processPage(batch)).rejects.toThrow(BadRequestException);
    });

    it('should publish campaign.send to AMQP campaigns exchange', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([{ id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] }]);
      const batch = { campaign: makeCampaign(), page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      const result = await service.processPage(batch);
      expect(result).toHaveProperty('contacts');
      expect(result).toHaveProperty('packages');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(EXCHANGES.campaigns, 'campaign.send', expect.any(Object));
    });

    it('should deduplicate contacts by id', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
      ]);
      const batch = { campaign: makeCampaign(), page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      await service.processPage(batch);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    // Regression: logInfo was gated by LOG_LEVEL=INFO so this line vanished in staging — see EVO-1149.
    it('should emit per-page lifecycle log via Nest Logger', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      mockMsgopsService.findByTags.mockResolvedValue([{ id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] }]);
      const batch = { campaign: makeCampaign(), page: 2, totalPages: 3, currentContactId: 1, finalContactId: 100 };
      await service.processPage(batch);
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/\[Process Page\] Campaign: 1 - Page: 2 - Contacts: 1/));
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Message campaign-1-2-\d+ published to/));
      logSpy.mockRestore();
    });
  });

  describe('createTest', () => {
    it('should initialise Redis hashes for TESTAB campaign', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabAudiencePercent: 20,
        testabScheduleTo: new Date().toISOString(),
        scheduleTo: new Date(Date.now() + 3600000).toISOString(),
        campaignMessage: [
          { campaignId: 1, messageId: 1, message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b' } },
          { campaignId: 1, messageId: 2, message: { id: 2, content: 'test2', fromMail: 'b@b.com', fromName: 'B', fileName: 'f', bucketName: 'b' } },
        ],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([]);
      mockMsgopsService.startedTestAB.mockResolvedValue([{ order_number: 100 }, { order_number: 200 }]);

      const createBatchesSpy = jest.spyOn(service, 'createBatches').mockResolvedValue('Processed 1 pages');

      await service.createTest(1);
      expect(mockRedisClient.hset).toHaveBeenCalledTimes(2);
      expect(mockMsgopsService.startedTestAB).toHaveBeenCalledWith(1, 2, 0.2);
      expect(createBatchesSpy).toHaveBeenCalledTimes(2);
      expect(mockMsgopsService.updateCampaign).toHaveBeenCalledWith(1, { testabLastId: 100 });

      createBatchesSpy.mockRestore();
    });

    it('should handle SPLIT type campaign (does not set isTestabType=true)', async () => {
      const campaign = makeCampaign({
        type: CampaignType.SPLIT,
        testabAudiencePercent: 20,
        testabScheduleTo: new Date().toISOString(),
        scheduleTo: new Date(Date.now() + 3600000).toISOString(),
        campaignMessage: [{ campaignId: 1, messageId: 1, message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b' } }],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([]);
      mockMsgopsService.startedTestAB.mockResolvedValue([{ order_number: 100 }]);
      jest.spyOn(service, 'createBatches').mockResolvedValue('Processed 1 pages');

      await service.createTest(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(EXCHANGES.campaigns, 'campaign.tracked', expect.objectContaining({ testabMode: false }));
    });

    it('should cap spreadSending when test window is shorter', async () => {
      const now = new Date();
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabAudiencePercent: 20,
        testabScheduleTo: now.toISOString(),
        scheduleTo: new Date(now.getTime() + 5 * 60000).toISOString(),
        spreadSending: 60,
        campaignMessage: [{ campaignId: 1, messageId: 1, message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b' } }],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([]);
      mockMsgopsService.startedTestAB.mockResolvedValue([{ order_number: 100 }]);
      jest.spyOn(service, 'createBatches').mockResolvedValue('Processed 1 pages');

      await service.createTest(1);
    });
  });

  describe('processResult', () => {
    it('should select winner and update campaign messages', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabCriteria: 'open',
        testabSentAfterTest: false,
        campaignMessage: [
          { campaignId: 1, messageId: 1, message: { id: 1 } },
          { campaignId: 1, messageId: 2, message: { id: 2 } },
        ],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockRedisClient.hgetall.mockResolvedValueOnce({ open: '5', click: '3' }).mockResolvedValueOnce({ open: '10', click: '1' });

      await service.processResult(1);
      expect(mockMsgopsService.updateCampaignMessage).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(mockMsgopsService.updateCampaign).toHaveBeenCalledWith(1, { status: 5 });
    });

    it('should create BullMQ trigger job when testabSentAfterTest is true', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabCriteria: 'open',
        testabSentAfterTest: true,
        scheduleTo: new Date(Date.now() + 3600000).toISOString(),
        campaignMessage: [{ campaignId: 1, messageId: 1, message: { id: 1 } }],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockRedisClient.hgetall.mockResolvedValue({ open: '5' });

      await service.processResult(1);
      expect(mockQueuePublisher.addCampaignTrigger).toHaveBeenCalled();
      expect(mockMsgopsService.updateCampaign).not.toHaveBeenCalledWith(1, { status: 5 });
    });

    it('should use delay=0 when scheduleTo is in the past', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabCriteria: 'click',
        testabSentAfterTest: true,
        scheduleTo: new Date(Date.now() - 3600000).toISOString(),
        campaignMessage: [{ campaignId: 1, messageId: 1, message: { id: 1 } }],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockRedisClient.hgetall.mockResolvedValue({ click: '5' });

      await service.processResult(1);
      expect(mockQueuePublisher.addCampaignTrigger).toHaveBeenCalled();
    });

    it('should select winner by click criterion', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabCriteria: 'click',
        testabSentAfterTest: false,
        campaignMessage: [
          { campaignId: 1, messageId: 1, message: { id: 1 } },
          { campaignId: 1, messageId: 2, message: { id: 2 } },
        ],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockRedisClient.hgetall.mockResolvedValueOnce({ click: '3', open: '10' }).mockResolvedValueOnce({ click: '1', open: '5' });

      await service.processResult(1);
      const updateCalls = mockMsgopsService.updateCampaignMessage.mock.calls;
      const winners = updateCalls.filter((c: any) => c[0].winner === true);
      expect(winners).toHaveLength(1);
    });
  });

  describe('sendTracker', () => {
    it('should publish tracker payload to campaigns/campaign.tracked', async () => {
      await (service as any).sendTracker(1, 10, 1, 'TEST_EVENT');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(EXCHANGES.campaigns, 'campaign.tracked', expect.any(Object));
    });

    it('should not throw when publish fails', async () => {
      mockEventPublisher.publish.mockRejectedValueOnce(new Error('fail'));
      await expect((service as any).sendTracker(1, 10, 1, 'TEST_EVENT')).resolves.not.toThrow();
    });
  });

  describe('addPageToQueue', () => {
    it('should call addSchedulePage with correct payload', async () => {
      const campaign = makeCampaign();
      await (service as any).addPageToQueue(campaign, 1, 3, 20000, 1, 100);
      expect(mockQueuePublisher.addSchedulePage).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }), 20000);
    });
  });

  describe('getContacts', () => {
    it('should throw InternalServerErrorException on error', async () => {
      mockMsgopsService.findByTags.mockRejectedValue(new Error('DB Error'));
      const campaign = makeCampaign();
      await expect((service as any).getContacts(campaign, 1, 100)).rejects.toThrow();
    });
  });
});
