import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { MessagesService } from './messages.service';
import { BucketsService } from '../buckets/buckets.service';
import { MessageEntity } from '../../entities/message.entity';
import { AutomationEntity } from '../../entities/automation.entity';
import { EmailsLabelsEntity } from '../../entities/emails-labels.entity';
import { LabelsContentsEntity } from '../../entities/labels-contents.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { MessageDto } from './messages.dto';
import { ClsService } from 'nestjs-cls';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { TestsService } from '../tests/tests.service';
import { RedisService } from '../../providers/redis.provider';
import { TwilioHandler } from '../../handlers/twilio/twilio.handler';
import { SchedulerService } from '../../providers/queue/scheduler.service';
import { AccountsService } from '../accounts/accounts.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { OpenAIProvider } from '../../providers/openai.provider';
import { LabelsService } from '../labels/labels.service';

describe('MessagesService - Unlayer Migration', () => {
  let service: MessagesService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn(),
    })),
    manager: {
      connection: {
        createQueryRunner: jest.fn(() => ({
          connect: jest.fn(),
          startTransaction: jest.fn(),
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
          manager: {
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn(),
            })),
          },
        })),
      },
    },
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockBucketsService = {
    uploadFiles: jest.fn(),
  };

  const mockClsService = {
    get: jest.fn((key: string) => {
      if (key === 'accountId') return 1;
      if (key === 'apiKey') return 'test-key';
      return null;
    }),
  };

  const mockStorageProvider = {
    writeContentIntoBucketFile: jest.fn(),
  };

  const mockTestsService = {};
  const mockRedisService = {
    getClient: jest.fn(() => ({
      del: jest.fn(),
    })),
  };
  const mockTwilioHandler = {};
  const mockSchedulerService = {};
  const mockAccountService = {};
  const mockCampaignsService = {
    messageInUse: jest.fn(() => []),
  };
  const mockOpenAIProvider = {};
  const mockLabelsService = {
    saveEntityLabelsSafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(MessageEntity), useValue: mockRepository },
        { provide: getRepositoryToken(AutomationEntity), useValue: mockRepository },
        { provide: getRepositoryToken(EmailsLabelsEntity), useValue: mockRepository },
        { provide: getRepositoryToken(LabelsContentsEntity), useValue: mockRepository },
        { provide: HttpService, useValue: mockHttpService },
        { provide: BucketsService, useValue: mockBucketsService },
        { provide: ClsService, useValue: mockClsService },
        { provide: S3StorageProvider, useValue: mockStorageProvider },
        { provide: TestsService, useValue: mockTestsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: TwilioHandler, useValue: mockTwilioHandler },
        { provide: SchedulerService, useValue: mockSchedulerService },
        { provide: AccountsService, useValue: mockAccountService },
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: OpenAIProvider, useValue: mockOpenAIProvider },
        { provide: LabelsService, useValue: mockLabelsService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    module.get<HttpService>(HttpService);
    module.get<BucketsService>(BucketsService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Migration Integration Tests', () => {
    it('should download and upload image successfully', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      // Mock HTTP download
      mockHttpService.get.mockReturnValue(
        of({
          data: imageBuffer,
          headers: { 'content-type': 'image/png' },
        }),
      );

      // Mock storage upload
      mockBucketsService.uploadFiles.mockResolvedValue([{ link: 'https://storage.googleapis.com/bucket/new-image.png' }]);

      const result = await (service as any).downloadAndUploadImage('https://cdn.tools.unlayer.com/old-image.png');

      expect(result).toBe('https://storage.googleapis.com/bucket/new-image.png');
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'https://cdn.tools.unlayer.com/old-image.png',
        expect.objectContaining({
          responseType: 'arraybuffer',
          timeout: 10000,
        }),
      );
      expect(mockBucketsService.uploadFiles).toHaveBeenCalled();
    });

    it('should handle 404 download errors', async () => {
      mockHttpService.get.mockReturnValue(
        throwError({
          response: { status: 404 },
        }),
      );

      await expect((service as any).downloadAndUploadImage('https://cdn.tools.unlayer.com/missing.png')).rejects.toThrow('Image not found (404)');
    });

    it('should handle download timeout', async () => {
      mockHttpService.get.mockReturnValue(
        throwError({
          code: 'ECONNABORTED',
        }),
      );

      await expect((service as any).downloadAndUploadImage('https://cdn.tools.unlayer.com/slow.png')).rejects.toThrow('Download timeout');
    });

    it('should handle storage upload failure', async () => {
      const imageBuffer = Buffer.from('fake-image-data');

      mockHttpService.get.mockReturnValue(
        of({
          data: imageBuffer,
          headers: { 'content-type': 'image/png' },
        }),
      );

      // Mock upload failure (no URL returned)
      mockBucketsService.uploadFiles.mockResolvedValue([{}]);

      await expect((service as any).downloadAndUploadImage('https://cdn.tools.unlayer.com/image.png')).rejects.toThrow('Storage upload failed - no URL returned');
    });

    it('should replace URLs in all three fields', () => {
      const messageDto: MessageDto = {
        content: '<img src="https://cdn.tools.unlayer.com/old.png" />',
        text: '<img src="https://assets.unlayer.com/old2.png" />',
        content_json: JSON.stringify({
          image: 'https://cdn.tools.unlayer.com/old3.png',
        }),
        type: 'email',
      };

      const urlMap = new Map([
        ['https://cdn.tools.unlayer.com/old.png', 'https://storage.googleapis.com/new.png'],
        ['https://assets.unlayer.com/old2.png', 'https://storage.googleapis.com/new2.png'],
        ['https://cdn.tools.unlayer.com/old3.png', 'https://storage.googleapis.com/new3.png'],
      ]);

      const result = (service as any).replaceUnlayerUrlsInDto(messageDto, urlMap);

      expect(result.content).toContain('https://storage.googleapis.com/new.png');
      expect(result.text).toContain('https://storage.googleapis.com/new2.png');
      expect(result.content_json).toContain('https://storage.googleapis.com/new3.png');
    });

    it('should skip migration when feature flag is disabled', async () => {
      const originalEnv = process.env.UNLAYER_MIGRATION_ENABLED;
      process.env.UNLAYER_MIGRATION_ENABLED = 'false';

      const messageDto: MessageDto = {
        content: '<img src="https://cdn.tools.unlayer.com/test.png" />',
        type: 'email',
      };

      const result = await (service as any).migrateUnlayerImages(messageDto);

      expect(result).toEqual(messageDto);
      expect(mockHttpService.get).not.toHaveBeenCalled();

      process.env.UNLAYER_MIGRATION_ENABLED = originalEnv;
    });

    it('should skip migration when no Unlayer URLs detected (early exit)', async () => {
      process.env.UNLAYER_MIGRATION_ENABLED = 'true';

      const messageDto: MessageDto = {
        content: '<img src="https://example.com/test.png" />',
        type: 'email',
      };

      const result = await (service as any).migrateUnlayerImages(messageDto);

      expect(result).toEqual(messageDto);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('should migrate images when feature flag is enabled and Unlayer URLs present', async () => {
      process.env.UNLAYER_MIGRATION_ENABLED = 'true';

      const messageDto: MessageDto = {
        content: '<img src="https://cdn.tools.unlayer.com/old.png" />',
        type: 'email',
      };

      const imageBuffer = Buffer.from('fake-image-data');

      mockHttpService.get.mockReturnValue(
        of({
          data: imageBuffer,
          headers: { 'content-type': 'image/png' },
        }),
      );

      mockBucketsService.uploadFiles.mockResolvedValue([{ link: 'https://storage.googleapis.com/bucket/new.png' }]);

      const result = await (service as any).migrateUnlayerImages(messageDto);

      expect(result.content).toContain('https://storage.googleapis.com/bucket/new.png');
      expect(result.content).not.toContain('https://cdn.tools.unlayer.com/old.png');
      expect(mockHttpService.get).toHaveBeenCalled();
      expect(mockBucketsService.uploadFiles).toHaveBeenCalled();
    });

    it('should throw error when migration fails', async () => {
      process.env.UNLAYER_MIGRATION_ENABLED = 'true';

      const messageDto: MessageDto = {
        content: '<img src="https://cdn.tools.unlayer.com/fail.png" />',
        type: 'email',
      };

      mockHttpService.get.mockReturnValue(
        throwError({
          response: { status: 500 },
          message: 'Server error',
        }),
      );

      await expect((service as any).migrateUnlayerImages(messageDto)).rejects.toThrow();
    });
  });
});
