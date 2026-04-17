import { NotFoundException } from '@nestjs/common';
import { MsgopsService } from './msgops.service';
import { Repository } from 'typeorm';
import { ContactEntity } from './entities/contact.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { ShortLinkEntity } from './entities/short-link.entity';
import { ClsService } from 'nestjs-cls';
import { RedisService } from '../providers/redis/redis.service';
import { FormatterUtils } from '../utils/formatter.utils';

describe('MsgopsService', () => {
  let service: MsgopsService;
  let contactRepository: Partial<Repository<ContactEntity>>;
  let contactTagRepository: Partial<Repository<ContactTagEntity>>;
  let accountConfigRepository: Partial<Repository<AccountConfigEntity>>;
  let accountApiKeyRepository: Partial<Repository<AccountApiKeyEntity>>;
  let shortLinkRepository: Partial<Repository<ShortLinkEntity>>;
  let formatterUtils: Partial<FormatterUtils>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let redisService: Partial<RedisService>;
  let clsService: Partial<ClsService>;

  beforeEach(() => {
    contactRepository = {
      findOneOrFail: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    contactTagRepository = {
      find: jest.fn(),
    };
    accountConfigRepository = {
      findOne: jest.fn(),
    };
    accountApiKeyRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    shortLinkRepository = {
      findOne: jest.fn(),
    };
    formatterUtils = {
      formatterEmail: jest.fn((e: string) => e),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
    };
    redisService = {
      getOrThrow: jest.fn().mockReturnValue(redis),
    };
    clsService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'accountId') return 42;
        if (key === 'apiKey') return 'test-api-key';
      }),
    };

    service = new MsgopsService(
      contactRepository as Repository<ContactEntity>,
      contactTagRepository as Repository<ContactTagEntity>,
      accountConfigRepository as Repository<AccountConfigEntity>,
      accountApiKeyRepository as Repository<AccountApiKeyEntity>,
      shortLinkRepository as Repository<ShortLinkEntity>,
      formatterUtils as FormatterUtils,
      redisService as RedisService,
      clsService as ClsService,
    );
  });

  describe('findContact()', () => {
    it('should find contact by email', async () => {
      const mockContact = { id: 1, email: 'test@test.com' } as any;
      (contactRepository.findOneOrFail as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findContact('e', 'test@test.com');

      expect(result).toEqual(mockContact);
      expect(contactRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { email: 'test@test.com', accountId: 42 },
      });
    });

    it('should find contact by hashed email', async () => {
      const mockContact = { id: 1, hashedEmail: 'abc123' } as any;
      (contactRepository.findOneOrFail as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findContact('h', 'abc123');

      expect(result).toEqual(mockContact);
      expect(contactRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { hashedEmail: 'abc123', accountId: 42 },
      });
    });

    it('should find contact by uuid', async () => {
      const mockContact = { id: 1, uuid: 'uuid-123' } as any;
      (contactRepository.findOneOrFail as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findContact('u', 'uuid-123');

      expect(result).toEqual(mockContact);
      expect(contactRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { uuid: 'uuid-123', accountId: 42 },
      });
    });

    it('should throw when contact not found', async () => {
      (contactRepository.findOneOrFail as jest.Mock).mockRejectedValue(new Error('not found'));

      await expect(service.findContact('e', 'missing@test.com')).rejects.toThrow();
    });
  });

  describe('findContactTags()', () => {
    it('should return tag IDs for contact matching real-time segments', async () => {
      redis.get.mockResolvedValue(JSON.stringify([1, 2, 3]));
      (contactTagRepository.find as jest.Mock).mockResolvedValue([{ tagId: 1 }, { tagId: 3 }]);

      const result = await service.findContactTags(100);

      expect(result).toEqual([1, 3]);
      expect(redis.get).toHaveBeenCalledWith('real_time_segment:42');
    });

    it('should return empty array when no segments in Redis', async () => {
      redis.get.mockResolvedValue(null);
      (contactTagRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await service.findContactTags(100);

      expect(result).toEqual([]);
    });
  });

  describe('accountsByEmail()', () => {
    it('should return contacts from specific accounts', async () => {
      const mockContacts = [
        { accountId: 1, lo: '2024-01-01' },
        { accountId: 5, lo: '2024-02-01' },
      ] as any;
      (contactRepository.find as jest.Mock).mockResolvedValue(mockContacts);

      const result = await service.accountsByEmail('test@test.com');

      expect(result).toEqual(mockContacts);
      expect(contactRepository.find).toHaveBeenCalledWith({
        where: {
          email: 'test@test.com',
          accountId: expect.anything(),
        },
        select: ['accountId', 'lo'],
      });
    });
  });

  describe('contactByEmail()', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
      };
      (contactRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
    });

    it('should return contact by email with basic fields', async () => {
      const mockContact = { email: 'test@test.com', firstName: 'John' };
      mockQueryBuilder.getRawOne.mockResolvedValue(mockContact);

      const result = await service.contactByEmail(42, 'test@test.com');

      expect(result).toEqual(mockContact);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('contacts.email, contacts.firstName,  contacts.lastName, contacts.phone');
    });

    it('should select all fields when details option is provided', async () => {
      const mockContact = { email: 'test@test.com', firstName: 'John', lastName: 'Doe' };
      mockQueryBuilder.getRawOne.mockResolvedValue(mockContact);

      const result = await service.contactByEmail(42, 'test@test.com', ['details']);

      expect(result).toEqual(mockContact);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('contacts.*');
    });

    it('should add tags lateral join when tags option is provided', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ email: 'test@test.com' });

      await service.contactByEmail(42, 'test@test.com', ['tags']);

      expect(mockQueryBuilder.leftJoin).toHaveBeenCalled();
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('tags');

      // Exercise the lateral join callback to get coverage
      const callback = mockQueryBuilder.leftJoin.mock.calls[0][0];
      const mockQb = { getQuery: null, setParameters: jest.fn() };
      const result = callback(mockQb);
      expect(result).toBe(mockQb);
      expect(mockQb.getQuery()).toContain('LATERAL');
    });

    it('should add segments lateral join when segments option is provided', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ email: 'test@test.com' });

      await service.contactByEmail(42, 'test@test.com', ['segments']);

      expect(mockQueryBuilder.leftJoin).toHaveBeenCalled();
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('segments');

      const callback = mockQueryBuilder.leftJoin.mock.calls[0][0];
      const mockQb = { getQuery: null, setParameters: jest.fn() };
      const result = callback(mockQb);
      expect(result).toBe(mockQb);
      expect(mockQb.getQuery()).toContain('LATERAL');
    });

    it('should add customFields lateral join when customFields option is provided', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ email: 'test@test.com' });

      await service.contactByEmail(42, 'test@test.com', ['customFields']);

      expect(mockQueryBuilder.leftJoin).toHaveBeenCalled();
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith('customFields');

      const callback = mockQueryBuilder.leftJoin.mock.calls[0][0];
      const mockQb = { getQuery: null, setParameters: jest.fn() };
      const result = callback(mockQb);
      expect(result).toBe(mockQb);
      expect(mockQb.getQuery()).toContain('LATERAL');
    });

    it('should throw NotFoundException when contact not found', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      await expect(service.contactByEmail(42, 'missing@test.com')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByConfig()', () => {
    it('should return cached config from Redis', async () => {
      const cachedConfig = JSON.stringify({ accountId: 42, name: 'api_key', value: 'test-key' });
      redis.get.mockResolvedValue(cachedConfig);

      const result = await service.findByConfig('test-key');

      expect(result).toEqual(JSON.parse(cachedConfig));
      expect(accountConfigRepository.findOne).not.toHaveBeenCalled();
    });

    it('should query database and cache result when not in Redis', async () => {
      const dbConfig = { accountId: 42, name: 'api_key', value: 'test-key' } as any;
      redis.get.mockResolvedValue(null);
      (accountConfigRepository.findOne as jest.Mock).mockResolvedValue(dbConfig);

      const result = await service.findByConfig('test-key');

      expect(result).toEqual(dbConfig);
      expect(redis.set).toHaveBeenCalledWith('accountConfig:test-key', JSON.stringify(dbConfig), 'EX', 86400);
    });

    it('should return null when config not found in Redis or database', async () => {
      redis.get.mockResolvedValue(null);
      (accountConfigRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findByConfig('invalid-key');

      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('findLongUrl()', () => {
    it('should return cached URL from Redis', async () => {
      redis.get.mockResolvedValue('https://example.com');

      const result = await service.findLongUrl('abc123');

      expect(result).toBe('https://example.com');
      expect(shortLinkRepository.findOne).not.toHaveBeenCalled();
    });

    it('should query database and cache when not in Redis', async () => {
      redis.get.mockResolvedValue(null);
      (shortLinkRepository.findOne as jest.Mock).mockResolvedValue({ shortCode: 'abc123', longUrl: 'https://example.com' });

      const result = await service.findLongUrl('abc123');

      expect(result).toBe('https://example.com');
      expect(redis.set).toHaveBeenCalledWith('redirect_short_link:abc123', 'https://example.com', 'EX', 86400);
    });

    it('should return undefined when short link not found', async () => {
      redis.get.mockResolvedValue(null);
      (shortLinkRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findLongUrl('nonexistent');

      expect(result).toBeUndefined();
    });
  });
});
