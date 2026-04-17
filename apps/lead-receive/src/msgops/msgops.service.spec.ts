import { MsgopsService } from './msgops.service';
import { createAccountEntity, createAccountConfigEntity } from '../__mocks__/test-fixtures';

describe('MsgopsService', () => {
  let service: MsgopsService;
  let mockAccountConfigRepo: any;
  let mockAccountApiKeyRepo: any;
  let mockAccountRepo: any;
  let mockRedis: any;
  let mockRedisService: any;

  beforeEach(() => {
    mockAccountConfigRepo = {
      findOne: jest.fn(),
    };
    mockAccountApiKeyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockAccountRepo = {
      findOneBy: jest.fn(),
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
    };
    mockRedisService = {
      getOrThrow: jest.fn().mockReturnValue(mockRedis),
    };

    service = new MsgopsService(mockAccountConfigRepo, mockAccountApiKeyRepo, mockAccountRepo, mockRedisService);
  });

  describe('findAccountByApiKey', () => {
    const apiKey = 'test-api-key';
    const encodedKey = Buffer.from(apiKey).toString('base64');
    const redisKey = `account:${encodedKey}`;

    it('should return cached account from Redis', async () => {
      const account = createAccountEntity();
      const serialized = JSON.stringify(account);
      mockRedis.get.mockResolvedValue(serialized);

      const result = await service.findAccountByApiKey(apiKey);

      expect(mockRedis.get).toHaveBeenCalledWith(redisKey);
      expect(result).toEqual(JSON.parse(serialized));
      expect(mockAccountConfigRepo.findOne).not.toHaveBeenCalled();
    });

    it('should query DB when Redis cache misses', async () => {
      const account = createAccountEntity();
      const config = createAccountConfigEntity({ value: apiKey });
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(config);
      mockAccountRepo.findOneBy.mockResolvedValue(account);

      const result = await service.findAccountByApiKey(apiKey);

      expect(mockAccountConfigRepo.findOne).toHaveBeenCalledWith({
        where: [
          { name: 'api_key', value: apiKey },
          { name: 'api_key_tracker', value: apiKey },
        ],
      });
      expect(mockAccountRepo.findOneBy).toHaveBeenCalledWith({ id: config.accountId });
      expect(mockRedis.set).toHaveBeenCalledWith(redisKey, JSON.stringify(account));
      expect(result).toEqual(account);
    });

    it('should return undefined when account config not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      const result = await service.findAccountByApiKey(apiKey);

      expect(result).toBeUndefined();
      expect(mockAccountRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('should return undefined when account not found by id', async () => {
      const config = createAccountConfigEntity({ value: apiKey });
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(config);
      mockAccountRepo.findOneBy.mockResolvedValue(null);

      const result = await service.findAccountByApiKey(apiKey);

      expect(result).toBeUndefined();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in Redis cache gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockRedis.get.mockResolvedValue('invalid-json');
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      const result = await service.findAccountByApiKey(apiKey);

      expect(result).toBeUndefined();
    });

    it('should encode apiKey to base64 for Redis key', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      await service.findAccountByApiKey('my-special-key');

      const expectedKey = `account:${Buffer.from('my-special-key').toString('base64')}`;
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should not set Redis cache when account is null', async () => {
      const config = createAccountConfigEntity();
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(config);
      mockAccountRepo.findOneBy.mockResolvedValue(null);

      await service.findAccountByApiKey(apiKey);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should set Redis cache when account is found from DB', async () => {
      const account = createAccountEntity();
      const config = createAccountConfigEntity();
      mockRedis.get.mockResolvedValue(null);
      mockAccountConfigRepo.findOne.mockResolvedValue(config);
      mockAccountRepo.findOneBy.mockResolvedValue(account);

      await service.findAccountByApiKey(apiKey);

      expect(mockRedis.set).toHaveBeenCalledWith(redisKey, JSON.stringify(account));
    });

    it('should handle Redis get returning empty string by falling through to DB', async () => {
      mockRedis.get.mockResolvedValue('');
      mockAccountConfigRepo.findOne.mockResolvedValue(null);

      const result = await service.findAccountByApiKey(apiKey);

      // empty string is falsy, so it should fall through to DB
      expect(mockAccountConfigRepo.findOne).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
