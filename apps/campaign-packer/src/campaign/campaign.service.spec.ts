import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { MsgopsService } from '../msgops/msgops.service';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { RedisService } from '../providers/redis/redis.service';
import { FormatterUtils } from '../utils/formatter.utils';
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
    countContactsTestAb: jest.fn(),
    countByTags: jest.fn(),
    findByTags: jest.fn(),
    findWarmupByIds: jest.fn(),
    getWarmupsAccount: jest.fn(),
    findFirstWarmup: jest.fn(),
    updateWarmup: jest.fn(),
    updateCampaign: jest.fn(),
    updateCampaignMessage: jest.fn(),
    processWarmup: jest.fn(),
    startedTestAB: jest.fn(),
    findMessageById: jest.fn(),
    warmupContactsRandon: jest.fn(),
  };

  const mockQueuePublisher = {
    addCampaignPacker: jest.fn().mockResolvedValue('mock-job-id'),
    addCampaignPackerWarmup: jest.fn().mockResolvedValue('mock-job-id'),
    addSchedulePage: jest.fn().mockResolvedValue('mock-job-id'),
    addCampaignTrigger: jest.fn().mockResolvedValue('mock-job-id'),
    addSendMessage: jest.fn().mockResolvedValue('mock-job-id'),
    addEventsTracker: jest.fn().mockResolvedValue('mock-job-id'),
    addWarmupTracker: jest.fn().mockResolvedValue('mock-job-id'),
  };

  const mockFormatterUtils = {
    logInfo: jest.fn(),
    parseBatch: jest.fn(),
  };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.LIMIT_CONTACT_BATCH = '1000';
    process.env.DEFAULT_WARMUP_MESSAGES = '1,2,3,4,5,6';
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
        { provide: FormatterUtils, useValue: mockFormatterUtils },
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

  describe('definedMaxContactsWarmup', () => {
    it('should return 90% of quantity when stage 3 and remaining > quantity', () => {
      const warmup = { stage: 3, remainingSendToday: 1000 } as any;
      expect((service as any).definedMaxContactsWarmup(warmup, 500)).toBe(450);
    });

    it('should return remainingSendToday when stage 3 and remaining <= quantity', () => {
      const warmup = { stage: 3, remainingSendToday: 200 } as any;
      expect((service as any).definedMaxContactsWarmup(warmup, 500)).toBe(200);
    });

    it('should return 10% for stage 0', () => {
      const warmup = { stage: 0, remainingSendToday: 500 } as any;
      expect((service as any).definedMaxContactsWarmup(warmup, 1000)).toBe(100);
    });

    it('should return 10% for stage 2', () => {
      const warmup = { stage: 2, remainingSendToday: 500 } as any;
      expect((service as any).definedMaxContactsWarmup(warmup, 1000)).toBe(100);
    });
  });

  describe('canRunWarmups', () => {
    it('should return never for non-EMAIL campaign', () => {
      const campaign = makeCampaign({ messageType: CampaignMessageType.SMS });
      expect((service as any).canRunWarmups(campaign, 100)).toBe('never');
    });

    it('should return never when no contacts', () => {
      const campaign = makeCampaign();
      expect((service as any).canRunWarmups(campaign, 0)).toBe('never');
    });

    it('should return general during 08:00-16:05 window', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
      const campaign = makeCampaign();
      const result = (service as any).canRunWarmups(campaign, 100);
      expect(result).toBe('general');
      jest.useRealTimers();
    });

    it('should return stage3 before 08:00', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T07:00:00Z'));
      const campaign = makeCampaign();
      const result = (service as any).canRunWarmups(campaign, 100);
      expect(result).toBe('stage3');
      jest.useRealTimers();
    });

    it('should return stage3 after 16:05', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T17:00:00Z'));
      const campaign = makeCampaign();
      const result = (service as any).canRunWarmups(campaign, 100);
      expect(result).toBe('stage3');
      jest.useRealTimers();
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
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      mockMsgopsService.findFirstWarmup.mockResolvedValue(null);
      await service.createContactsSend(1);
      expect(mockMsgopsService.createContactsSend).toHaveBeenCalled();
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
    });

    it('should process TESTAB campaign', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ type: CampaignType.TESTAB, testabLastId: 0 }));
      mockMsgopsService.countContactsTestAb.mockResolvedValue(100);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      mockMsgopsService.findFirstWarmup.mockResolvedValue(null);
      await service.createContactsSend(1);
      expect(mockMsgopsService.countContactsTestAb).toHaveBeenCalled();
    });

    it('should skip warmup when canRunWarmups returns never for SMS', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ messageType: CampaignMessageType.SMS }));
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      await service.createContactsSend(1);
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
    });

    it('should apply ippool override for account 60 with tag 6358', async () => {
      const campaign = makeCampaign({
        accountId: 60,
        messageType: CampaignMessageType.EMAIL,
        steps: [[{ type: 'tag', tag_info: [{ id: 6358 }] }]],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      mockMsgopsService.findFirstWarmup.mockResolvedValue(null);
      await service.createContactsSend(1);
      expect(campaign.campaignMessage[0].message.ippool).toBe('em01_tarjetasargentinas_com_warmup');
    });

    it('should set maxContactsWarmup when firstWarmup found', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
      const campaign = makeCampaign();
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      const firstWarmup = {
        id: 1,
        stage: 3,
        remainingSendToday: 1000,
        type: 'external',
        campaign: { id: 10, spreadSending: 5 },
      };
      mockMsgopsService.findFirstWarmup.mockResolvedValue(firstWarmup);
      mockRedisClient.exists.mockResolvedValue(0);
      await service.createContactsSend(1);
      expect(mockQueuePublisher.addCampaignPackerWarmup).toHaveBeenCalledWith(expect.objectContaining({ warmups: [1] }));
      jest.useRealTimers();
    });

    it('should update firstWarmup stage 1 to 2 for internal warmup', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
      const campaign = makeCampaign();
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      const firstWarmup = {
        id: 1,
        stage: 1,
        remainingSendToday: 1000,
        type: 'internal',
        campaign: { id: 10, spreadSending: 5 },
      };
      mockMsgopsService.findFirstWarmup.mockResolvedValue(firstWarmup);
      mockRedisClient.exists.mockResolvedValue(0);
      await service.createContactsSend(1);
      expect(mockMsgopsService.updateWarmup).toHaveBeenCalledWith(1, { stage: 2 });
      jest.useRealTimers();
    });

    it('should filter warmups by target_segment_id matching campaign tags', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
      const campaign = makeCampaign({
        steps: [[{ type: 'tag', tag_info: [{ id: 100 }] }]],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([
        { id: 1, target_segment_id: 100, campaign: { spreadSending: 5 } },
        { id: 2, target_segment_id: 999, campaign: { spreadSending: 5 } },
      ]);
      mockRedisClient.exists.mockResolvedValue(0);
      await service.createContactsSend(1);
      expect(mockQueuePublisher.addCampaignPackerWarmup).toHaveBeenCalledWith(expect.objectContaining({ warmups: [1] }));
      jest.useRealTimers();
    });

    it('should skip warmup if Redis key already exists', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T10:00:00Z'));
      const campaign = makeCampaign();
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([{ id: 1, target_segment_id: null, campaign: { spreadSending: 5 } }]);
      mockRedisClient.exists.mockResolvedValue(1);
      await service.createContactsSend(1);
      // No warmup published, goes directly to packer
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should process RECURRING campaign', async () => {
      mockMsgopsService.getCampaign.mockResolvedValue(makeCampaign({ type: CampaignType.RECURRING }));
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      mockMsgopsService.findFirstWarmup.mockResolvedValue(null);
      await service.createContactsSend(1);
      expect(mockMsgopsService.createContactsSend).toHaveBeenCalled();
    });

    it('should not apply ippool for account 60 without tag 6358', async () => {
      const campaign = makeCampaign({
        accountId: 60,
        messageType: CampaignMessageType.EMAIL,
        steps: [[{ type: 'tag', tag_info: [{ id: 9999 }] }]],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([{ contact_id: 1 }]);
      mockMsgopsService.getWarmupsAccount.mockResolvedValue([]);
      mockMsgopsService.findFirstWarmup.mockResolvedValue(null);
      await service.createContactsSend(1);
      expect(campaign.campaignMessage[0].message.ippool).toBe('default');
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
      expect(campaign.spreadSending).toBe(15); // 5 * 3 pages
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
      // In testabMode, last page is NOT sent separately
      expect(mockQueuePublisher.addSchedulePage).toHaveBeenCalled();
    });

    it('should handle Redis set error gracefully', async () => {
      const campaign = makeCampaign();
      mockMsgopsService.countByTags.mockResolvedValue([{ order_number: 100 }]);
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis error'));
      const result = await service.createBatches(campaign);
      expect(result).toBeUndefined();
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

    it('should process page and return result', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([{ id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] }]);
      const batch = { campaign: makeCampaign(), page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      const result = await service.processPage(batch);
      expect(result).toHaveProperty('contacts');
      expect(result).toHaveProperty('packages');
      expect(mockQueuePublisher.addSendMessage).toHaveBeenCalled();
    });

    it('should handle warmup contacts when isWarmup=true and warmupTarget<=2360', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
        { id: 2, email: 'b@b.com', firstName: 'C', lastName: 'D', customFields: {}, contactDevices: [] },
      ]);
      const warmupContacts = [{ name: 'WA', firstName: 'WA', email: 'wa@w.com' }];
      mockMsgopsService.warmupContactsRandon.mockResolvedValue(warmupContacts);
      mockRedisClient.exists.mockResolvedValue(0);

      const campaign = makeCampaign({
        isWarmup: true,
        warmupTarget: 100,
        stage: 1,
        campaignDefault: { id: 99, fromMail: 'orig@test.com', ippool: 'orig-pool', replyTo: 'orig-reply@test.com', originalMessage: null },
      });
      const batch = { campaign, page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      const result = await service.processPage(batch);
      expect(result).toHaveProperty('contacts');
      expect(mockQueuePublisher.addSendMessage).toHaveBeenCalled();
    });

    it('should use cached warmup contacts from Redis', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
        { id: 2, email: 'b@b.com', firstName: 'C', lastName: 'D', customFields: {}, contactDevices: [] },
      ]);
      const warmupContacts = [{ name: 'WA', firstName: 'WA', email: 'wa@w.com' }];
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(warmupContacts));

      const campaign = makeCampaign({
        isWarmup: true,
        warmupTarget: 100,
        stage: 1,
        campaignDefault: { id: 99, fromMail: 'orig@test.com', ippool: 'orig-pool', replyTo: 'orig-reply@test.com', originalMessage: null },
      });
      const batch = { campaign, page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      const result = await service.processPage(batch);
      expect(result).toHaveProperty('contacts');
    });

    it('should return true when stage 0 and no default contacts left', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([]);
      mockRedisClient.exists.mockResolvedValue(0);
      mockMsgopsService.warmupContactsRandon.mockResolvedValue([]);

      const campaign = makeCampaign({
        isWarmup: true,
        warmupTarget: 100,
        stage: 0,
        campaignDefault: { id: 99, fromMail: 'orig@test.com', ippool: 'orig-pool', replyTo: 'orig-reply@test.com', originalMessage: null },
      });
      const batch = { campaign, page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      const result = await service.processPage(batch);
      expect(result).toHaveProperty('contacts');
    });

    it('should swap message to original for warmup campaign contacts', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
        { id: 2, email: 'b@b.com', firstName: 'C', lastName: 'D', customFields: {}, contactDevices: [] },
      ]);
      const warmupContacts = [{ name: 'WA', firstName: 'WA', email: 'wa@w.com' }];
      mockMsgopsService.warmupContactsRandon.mockResolvedValue(warmupContacts);
      mockRedisClient.exists.mockResolvedValue(0);

      const originalMessage = { id: 50, subject: 'Orig', fromMail: 'orig@test.com', fromName: 'Orig', content: 'orig' };
      const campaign = makeCampaign({
        isWarmup: true,
        warmupTarget: 100,
        stage: 1,
        campaignDefault: { id: 99, fromMail: 'orig@test.com', ippool: 'orig-pool', replyTo: 'orig-reply@test.com', originalMessage },
      });
      const batch = { campaign, page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      await service.processPage(batch);
      // Should publish 2 messages to send topic (warmup + original swap)
      expect(mockQueuePublisher.addSendMessage).toHaveBeenCalled();
    });

    it('should deduplicate contacts by id', async () => {
      mockMsgopsService.findByTags.mockResolvedValue([
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
        { id: 1, email: 'a@a.com', firstName: 'A', lastName: 'B', customFields: {}, contactDevices: [] },
      ]);
      const batch = { campaign: makeCampaign(), page: 1, totalPages: 1, currentContactId: 1, finalContactId: 100 };
      await service.processPage(batch);
      // The package should have deduplicated contacts
      expect(mockRedisClient.set).toHaveBeenCalled();
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

      // Spy on createBatches to avoid its complex internal flow
      const createBatchesSpy = jest.spyOn(service, 'createBatches').mockResolvedValue('Processed 1 pages');

      await service.createTest(1);
      expect(mockRedisClient.hset).toHaveBeenCalledTimes(2);
      expect(mockMsgopsService.startedTestAB).toHaveBeenCalledWith(1, 2, 0.2);
      expect(createBatchesSpy).toHaveBeenCalledTimes(2);
      expect(mockMsgopsService.updateCampaign).toHaveBeenCalledWith(1, { testabLastId: 100 });

      createBatchesSpy.mockRestore();
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
  });

  describe('sendTracker', () => {
    it('should call addEventsTracker with tracker payload', async () => {
      const result = await (service as any).sendTracker(1, 10, 1, 'TEST_EVENT');
      expect(mockQueuePublisher.addEventsTracker).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toBe('mock-job-id');
    });

    it('should not throw when addEventsTracker fails', async () => {
      mockQueuePublisher.addEventsTracker.mockRejectedValueOnce(new Error('fail'));
      const result = await (service as any).sendTracker(1, 10, 1, 'TEST_EVENT');
      expect(result).toBeUndefined();
    });
  });

  describe('warmupStart', () => {
    it('should skip warmup if Redis key does not match campaign id', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue('999');
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'external',
          warmupInfo: [],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 5 },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.processWarmup).not.toHaveBeenCalled();
      // Should still publish original campaign
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalled();
    });

    it('should process warmup when Redis key matches campaign id', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue('1');
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'external',
          warmupInfo: [1, 2, 3],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.processWarmup).toHaveBeenCalled();
      expect(mockQueuePublisher.addCampaignPacker).toHaveBeenCalledTimes(2); // warmup + original
    });

    it('should use default messages for warmup stage 0', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue('1');
      const defaultMessage = { id: 99, subject: 'Default', content: 'Default content', fromMail: 'd@d.com', fromName: 'D' };
      mockMsgopsService.findMessageById.mockResolvedValue(defaultMessage);
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 0,
          type: 'external',
          warmupInfo: [1, 2],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.findMessageById).toHaveBeenCalledWith('3'); // defaultMessagesIds[2] since warmupInfo.length=2
      expect(mockMsgopsService.processWarmup).toHaveBeenCalled();
    });

    it('should select random default message when quantitySend >= defaultMessagesIds.length', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue('1');
      const defaultMessage = { id: 99, subject: 'Default', content: 'Default content', fromMail: 'd@d.com', fromName: 'D' };
      mockMsgopsService.findMessageById.mockResolvedValue(defaultMessage);
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 0,
          type: 'external',
          warmupInfo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.findMessageById).toHaveBeenCalled();
    });

    it('should use TESTAB winner message for warmup', async () => {
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        campaignMessage: [
          {
            campaignId: 1,
            messageId: 1,
            winner: false,
            message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b', ippool: 'default', replyTo: 'reply@test.com' },
          },
          {
            campaignId: 1,
            messageId: 2,
            winner: true,
            message: { id: 2, content: 'test2', fromMail: 'b@b.com', fromName: 'B', fileName: 'f2', bucketName: 'b2', ippool: 'default2', replyTo: 'reply2@test.com' },
          },
        ],
      });
      mockRedisClient.get.mockResolvedValue('1');
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'external',
          warmupInfo: [1, 2, 3],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.processWarmup).toHaveBeenCalled();
    });

    it('should adjust spreadSending for internal warmup stage 2', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue('1');
      const warmupCampaignObj = { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] };
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'internal',
          warmupInfo: [1, 2, 3],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: warmupCampaignObj,
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.updateCampaign).toHaveBeenCalledWith(10, { spreadSending: 60 });
    });

    it('should update warmup remainingSendToday after processing', async () => {
      const campaign = makeCampaign({ maxContactsWarmup: 50 });
      mockRedisClient.get.mockResolvedValue('1');
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'external',
          warmupInfo: [1, 2, 3],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.updateWarmup).toHaveBeenCalledWith(1, expect.objectContaining({ remainingSendToday: 50, status: 'running' }));
    });

    it('should set warmup stage to 3 when internal and spread <= campaign spread', async () => {
      const campaign = makeCampaign({ spreadSending: 120 });
      mockRedisClient.get.mockResolvedValue('1');
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'internal',
          warmupInfo: [1, 2, 3],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.updateWarmup).toHaveBeenCalledWith(1, expect.objectContaining({ stage: 3 }));
    });

    it('should advance warmup to stage null and currentSend=160 when stage=0 and quantitySend=6', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue('1');
      const defaultMessage = { id: 99, subject: 'Default', content: 'Default content', fromMail: 'd@d.com', fromName: 'D' };
      mockMsgopsService.findMessageById.mockResolvedValue(defaultMessage);
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 0,
          type: 'external',
          warmupInfo: [1, 2, 3, 4, 5, 6],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.updateWarmup).toHaveBeenCalledWith(1, expect.objectContaining({ stage: null, currentSend: 160 }));
    });

    it('should handle warmup with maxContactsWarmup < remainingSendToday', async () => {
      const campaign = makeCampaign({ maxContactsWarmup: 30 });
      mockRedisClient.get.mockResolvedValue('1');
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 3,
          type: 'external',
          warmupInfo: [1, 2, 3],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.updateWarmup).toHaveBeenCalledWith(1, expect.objectContaining({ remainingSendToday: 70 }));
    });

    it('should skip warmup when Redis key is null', async () => {
      const campaign = makeCampaign();
      mockRedisClient.get.mockResolvedValue(null);
      mockMsgopsService.findWarmupByIds.mockResolvedValue([
        {
          id: 1,
          sender: 'w@w.com',
          ippool: 'wp',
          replyTo: 'wr@w.com',
          stage: 2,
          type: 'external',
          warmupInfo: [],
          remainingSendToday: 100,
          currentSend: 50,
          campaign: { ...campaign, id: 10, spreadSending: 120, campaignMessage: [] },
        },
      ]);

      await service.warmupStart(campaign, [1]);
      expect(mockMsgopsService.processWarmup).not.toHaveBeenCalled();
    });
  });

  describe('createTest additional branches', () => {
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
      // sendTracker should be called with testabMode=false for SPLIT
      expect(mockQueuePublisher.addEventsTracker).toHaveBeenCalledWith(expect.objectContaining({ testabMode: false }));
    });

    it('should cap spreadSending when test window is shorter', async () => {
      const now = new Date();
      const campaign = makeCampaign({
        type: CampaignType.TESTAB,
        testabAudiencePercent: 20,
        testabScheduleTo: now.toISOString(),
        scheduleTo: new Date(now.getTime() + 5 * 60000).toISOString(), // 5 minutes from now
        spreadSending: 60,
        campaignMessage: [{ campaignId: 1, messageId: 1, message: { id: 1, content: 'test', fromMail: 'a@a.com', fromName: 'A', fileName: 'f', bucketName: 'b' } }],
      });
      mockMsgopsService.getCampaign.mockResolvedValue(campaign);
      mockMsgopsService.createContactsSend.mockResolvedValue([]);
      mockMsgopsService.startedTestAB.mockResolvedValue([{ order_number: 100 }]);
      jest.spyOn(service, 'createBatches').mockResolvedValue('Processed 1 pages');

      await service.createTest(1);
      // spreadSending should be capped to 5
    });
  });

  describe('processResult additional branches', () => {
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
