import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MsgopsService } from './msgops.service';
import { AccountConfigEntity } from './entities/account-config.entity';
import { CampaignMessageEntity } from './entities/campaign-message.entity';
import { ContactEntity } from './entities/contact.entity';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { AccountEntity } from './entities/account.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { MessageEntity } from './entities/message.entity';
import { TagProcessProvider } from '../providers/tag-process.provider';
import { EntityManager } from 'typeorm';
import { CampaignMessageType } from '../interfaces';

describe('MsgopsService', () => {
  let service: MsgopsService;

  const mockCampaignRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockContactRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockCampaignContactRepository = {
    count: jest.fn(),
  };

  const mockAccountRepository = {
    findOne: jest.fn(),
  };

  const mockAccountConfigRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockCampaignMessageRepository = {
    save: jest.fn(),
  };

  const mockCustomFieldRepository = {
    find: jest.fn(),
  };

  const mockMessageRepository = {
    findOne: jest.fn(),
  };

  const mockEntityManager = {
    query: jest.fn(),
  };

  const mockTagProcessProvider = {
    processSegment: jest.fn().mockResolvedValue({}),
  };

  beforeAll(() => {
    process.env.LIMIT_CONTACT_BATCH = '1000';
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsgopsService,
        { provide: getRepositoryToken(AccountConfigEntity), useValue: mockAccountConfigRepository },
        { provide: getRepositoryToken(CampaignMessageEntity), useValue: mockCampaignMessageRepository },
        { provide: getRepositoryToken(ContactEntity), useValue: mockContactRepository },
        { provide: getRepositoryToken(CampaignEntity), useValue: mockCampaignRepository },
        { provide: getRepositoryToken(CampaignContactEntity), useValue: mockCampaignContactRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: mockAccountRepository },
        { provide: getRepositoryToken(CustomFieldsEntity), useValue: mockCustomFieldRepository },
        { provide: getRepositoryToken(MessageEntity), useValue: mockMessageRepository },
        { provide: EntityManager, useValue: mockEntityManager },
        { provide: TagProcessProvider, useValue: mockTagProcessProvider },
      ],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
  });

  describe('getCampaign', () => {
    it('should return campaign with account attached', async () => {
      const campaign = { id: 1, accountId: 1 };
      const account = { id: 1, name: 'Test', accountConfigs: [], customFields: [] };
      mockCampaignRepository.findOne.mockResolvedValue(campaign);
      mockAccountRepository.findOne.mockResolvedValue(account);
      mockCustomFieldRepository.find.mockResolvedValue([]);
      mockAccountConfigRepository.find.mockResolvedValue([]);

      const result = await service.getCampaign(1);
      expect(result.account).toBeDefined();
    });
  });

  describe('getLimit', () => {
    it('should return LIMIT_CONTACT_BATCH when divider exceeds limit', async () => {
      mockCampaignContactRepository.count.mockResolvedValue(100000);
      const campaign = { id: 1, spreadSending: 10 } as any;
      const result = await (service as any).getLimit(campaign);
      expect(result).toBe(1000);
    });

    it('should return computed divider when smaller than limit', async () => {
      mockCampaignContactRepository.count.mockResolvedValue(100);
      const campaign = { id: 1, spreadSending: 10 } as any;
      const result = await (service as any).getLimit(campaign);
      expect(result).toBe(10);
    });
  });

  describe('countByTags', () => {
    it('should return page boundaries', async () => {
      const rows = [{ order_number: 300 }, { order_number: 200 }, { order_number: 100 }];
      mockEntityManager.query.mockResolvedValue(rows);
      mockCampaignContactRepository.count.mockResolvedValue(300);

      const campaign = { id: 1, spreadSending: 10 } as any;
      const result = await service.countByTags(campaign, 0, 0);
      expect(result).toEqual(rows);
    });
  });

  describe('createContactsSend', () => {
    it('should execute INSERT and return results', async () => {
      const campaign = {
        id: 1,
        accountId: 1,
        query: 'SELECT contact_id FROM contacts_tags WHERE tag_id = 1',
        runSegment: false,
      } as any;
      mockEntityManager.query.mockResolvedValue([{ contact_id: 1 }]);
      const result = await service.createContactsSend(campaign);
      expect(result).toEqual([{ contact_id: 1 }]);
    });

    it('should run segment processing when runSegment is true', async () => {
      const campaign = {
        id: 1,
        accountId: 1,
        query: 'SELECT 1',
        runSegment: true,
        tags: [{ id: 10 }, { id: 20 }],
      } as any;
      mockEntityManager.query.mockResolvedValue([]);
      await service.createContactsSend(campaign);
      expect(mockTagProcessProvider.processSegment).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateCampaign', () => {
    it('should delegate to repository', async () => {
      await service.updateCampaign(1, { status: 2 });
      expect(mockCampaignRepository.update).toHaveBeenCalledWith(1, { status: 2 });
    });
  });

  describe('updateCampaignMessage', () => {
    it('should save via repository', async () => {
      const msg = { campaignId: 1, messageId: 1, winner: true };
      await service.updateCampaignMessage(msg);
      expect(mockCampaignMessageRepository.save).toHaveBeenCalledWith(msg);
    });
  });

  describe('countContactsTestAb', () => {
    it('should count contacts above lastId', async () => {
      mockCampaignContactRepository.count.mockResolvedValue(50);
      const result = await service.countContactsTestAb(1, 500);
      expect(result).toBe(50);
    });
  });

  describe('findMessageById', () => {
    it('should return message entity', async () => {
      const msg = { id: 5, title: 'Test' };
      mockMessageRepository.findOne.mockResolvedValue(msg);
      const result = await service.findMessageById('5');
      expect(result).toEqual(msg);
    });
  });

  describe('findByTags', () => {
    function createMockQb() {
      return {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1, email: 'a@a.com' }]),
      };
    }

    it('should return contacts from query builder for EMAIL', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.EMAIL } as any;
      const result = await service.findByTags(campaign, 1, 100);
      expect(result).toHaveLength(1);
      expect(mockQb.andWhere).toHaveBeenCalledWith('contacts.has_email = true');
    });

    it('should add phone filter for SMS type', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.SMS } as any;
      await service.findByTags(campaign, 1, 100);
      expect(mockQb.andWhere).toHaveBeenCalledWith('contacts.has_phone = true');
    });

    it('should add whatsapp filter for WHATSAPP type', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.WHATSAPP } as any;
      await service.findByTags(campaign, 1, 100);
      expect(mockQb.andWhere).toHaveBeenCalledWith('contacts.has_whatsapp = true');
    });

    it('should join devices for MOBILEPUSH type', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.MOBILEPUSH } as any;
      await service.findByTags(campaign, 1, 100);
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('contacts.contactDevices', 'contactsDevices');
      expect(mockQb.andWhere).toHaveBeenCalledWith('contactsDevices.type = :type', { type: 'mobile-push' });
    });

    it('should join devices for WEBPUSH type', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.WEBPUSH } as any;
      await service.findByTags(campaign, 1, 100);
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('contacts.contactDevices', 'contactsDevices');
    });

    it('should use limit when finalContactId is 0', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.EMAIL } as any;
      await service.findByTags(campaign, 1, 0);
      expect(mockQb.limit).toHaveBeenCalledWith(1000);
    });

    it('should use BETWEEN when finalContactId is set', async () => {
      const mockQb = createMockQb();
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.EMAIL } as any;
      await service.findByTags(campaign, 1, 100);
      expect(mockQb.andWhere).toHaveBeenCalledWith('campaignContacts.order_number BETWEEN :currentContactId AND :finalContactId', { currentContactId: 1, finalContactId: 100 });
    });

    it('should throw HttpException on error', async () => {
      const mockQb = createMockQb();
      mockQb.getMany.mockRejectedValue(new Error('DB Error'));
      mockContactRepository.createQueryBuilder.mockReturnValue(mockQb);

      const campaign = { id: 1, account: { id: 1 }, messageType: CampaignMessageType.EMAIL } as any;
      await expect(service.findByTags(campaign, 1, 100)).rejects.toThrow();
    });
  });

  describe('countByTags additional branches', () => {
    it('should apply lastSentId and finalId filters in SQL', async () => {
      const rows = [{ order_number: 100 }];
      mockEntityManager.query.mockResolvedValue(rows);
      mockCampaignContactRepository.count.mockResolvedValue(100);

      const campaign = { id: 1, spreadSending: 10 } as any;
      await service.countByTags(campaign, 100, 500);
      expect(mockEntityManager.query).toHaveBeenCalledWith(expect.stringContaining('AND order_number > 100'));
      expect(mockEntityManager.query).toHaveBeenCalledWith(expect.stringContaining('AND order_number <= 500'));
    });

    it('should throw HttpException on error', async () => {
      mockEntityManager.query.mockRejectedValue(new Error('DB Error'));
      mockCampaignContactRepository.count.mockResolvedValue(100);

      const campaign = { id: 1, spreadSending: 10 } as any;
      await expect(service.countByTags(campaign, 0, 0)).rejects.toThrow();
    });
  });

  describe('getLimit additional branches', () => {
    it('should return limit when spreadSending is 0', async () => {
      mockCampaignContactRepository.count.mockResolvedValue(100);
      const campaign = { id: 1, spreadSending: 0 } as any;
      const result = await (service as any).getLimit(campaign);
      expect(result).toBe(1000);
    });
  });

  describe('findAccountConfig', () => {
    it('should return account config', async () => {
      const config = { accountId: 1, name: 'time_zone', value: 'UTC' };
      mockAccountConfigRepository.findOne.mockResolvedValue(config);
      const result = await service.findAccountConfig(1, 'time_zone');
      expect(result).toEqual(config);
    });
  });

  describe('startedTestAB', () => {
    it('should execute percent_rank SQL query', async () => {
      mockEntityManager.query.mockResolvedValue([{ order_number: 100 }]);
      const result = await service.startedTestAB(1, 2, 0.2);
      expect(mockEntityManager.query).toHaveBeenCalledWith(expect.stringContaining('percent_rank'));
      expect(result).toEqual([{ order_number: 100 }]);
    });
  });
});
