import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppService } from './app.service';
import { SlackService } from './services/slack.service';
import { WarmupUserEntity } from './entities/warmup-user.entity';
import { NotifyPayload, Message } from './interfaces';

describe('AppService', () => {
  let appService: AppService;
  let slackService: jest.Mocked<SlackService>;
  let warmupUserRepository: jest.Mocked<Pick<Repository<WarmupUserEntity>, 'find'>>;

  const mockUser: WarmupUserEntity = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    isInternal: true,
    slackId: 'U12345',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockPayload: NotifyPayload = {
    warmup: 1,
    message: {
      id: 100,
      subject: 'Test Subject',
      email: 'sender@example.com',
      name: 'Sender',
    },
    recipients: [{ name: 'Test User', email: 'test@example.com' }],
  };

  beforeEach(async () => {
    warmupUserRepository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: SlackService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(WarmupUserEntity),
          useValue: warmupUserRepository,
        },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
    slackService = module.get(SlackService);
  });

  it('should be defined', () => {
    expect(appService).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(appService.getHello()).toBe('Hello World!');
    });
  });

  describe('notify', () => {
    it('should return undefined when data is null/undefined', async () => {
      const result = await appService.notify(null as any);
      expect(result).toBeUndefined();
    });

    it('should query repository for internal users matching recipient emails', async () => {
      warmupUserRepository.find.mockResolvedValue([mockUser]);
      await appService.notify(mockPayload);
      expect(warmupUserRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isInternal: true,
          }),
        })
      );
    });

    it('should throw NotFoundException when no internal users found', async () => {
      warmupUserRepository.find.mockResolvedValue([]);
      await expect(appService.notify(mockPayload)).rejects.toThrow(NotFoundException);
    });

    it('should call slackService.sendMessage for each internal user', async () => {
      const user2: WarmupUserEntity = {
        ...mockUser,
        id: 2,
        name: 'User Two',
        slackId: 'U67890',
      };
      warmupUserRepository.find.mockResolvedValue([mockUser, user2]);

      await appService.notify(mockPayload);

      expect(slackService.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should return { ok: true } on success', async () => {
      warmupUserRepository.find.mockResolvedValue([mockUser]);
      const result = await appService.notify(mockPayload);
      expect(result).toEqual({ ok: true });
    });

    it('should return the error when slackService.sendMessage throws', async () => {
      warmupUserRepository.find.mockResolvedValue([mockUser]);
      const error = new Error('Slack API error');
      slackService.sendMessage.mockRejectedValue(error);

      const result = await appService.notify(mockPayload);
      expect(result).toBe(error);
    });

    it('should call parsePayload with message and user', async () => {
      warmupUserRepository.find.mockResolvedValue([mockUser]);
      const spy = jest.spyOn(appService, 'parsePayload');

      await appService.notify(mockPayload);

      expect(spy).toHaveBeenCalledWith(mockPayload.message, mockUser);
    });
  });

  describe('parsePayload', () => {
    const message: Message = {
      id: 1,
      subject: 'Hello %FIRST_NAME% World',
      email: 'sender@test.com',
      name: 'Sender Name',
    };

    it('should return an object with userId, blocks, and text', () => {
      const result = appService.parsePayload(message, mockUser);
      expect(result).toHaveProperty('userId', mockUser.slackId);
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('text');
    });

    it('should include the recipient name in the greeting block', () => {
      const result = appService.parsePayload(message, mockUser);
      const firstBlock = result.blocks[0] as any;
      expect(firstBlock.text.text).toContain(mockUser.name);
    });

    it('should remove placeholders from the subject in blocks', () => {
      const result = appService.parsePayload(message, mockUser);
      const subjectBlock = result.blocks[1] as any;
      expect(subjectBlock.text.text).not.toContain('%FIRST_NAME%');
      expect(subjectBlock.text.text).toContain('Assunto: Hello  World');
    });

    it('should include a Gmail deep-link button', () => {
      const result = appService.parsePayload(message, mockUser);
      const buttonBlock = result.blocks[2] as any;
      expect(buttonBlock.accessory.type).toBe('button');
      expect(buttonBlock.accessory.url).toContain('https://mail.google.com/mail');
      expect(buttonBlock.accessory.url).toContain(`authuser=${mockUser.email}`);
    });

    it('should encode the search query in the Gmail URL', () => {
      const result = appService.parsePayload(message, mockUser);
      const buttonBlock = result.blocks[2] as any;
      expect(buttonBlock.accessory.url).toContain(encodeURIComponent(message.email).replace(/%20/g, '+'));
    });

    it('should include a divider block', () => {
      const result = appService.parsePayload(message, mockUser);
      const divider = result.blocks.find((b: any) => b.type === 'divider');
      expect(divider).toBeDefined();
    });

    it('should include a context block with instructions', () => {
      const result = appService.parsePayload(message, mockUser);
      const context = result.blocks.find((b: any) => b.type === 'context') as any;
      expect(context).toBeDefined();
      expect(context.elements[0].text).toContain('SPAM');
    });

    it('should have 6 blocks total', () => {
      const result = appService.parsePayload(message, mockUser);
      expect(result.blocks).toHaveLength(6);
    });
  });

  describe('removePlaceholders', () => {
    it('should remove %PLACEHOLDER% patterns', () => {
      expect(appService.removePlaceholders('Hello %NAME% there')).toBe('Hello  there');
    });

    it('should remove multiple placeholders', () => {
      expect(appService.removePlaceholders('%FIRST% and %LAST%')).toBe(' and ');
    });

    it('should leave text without placeholders unchanged', () => {
      expect(appService.removePlaceholders('Hello World')).toBe('Hello World');
    });

    it('should handle an empty string', () => {
      expect(appService.removePlaceholders('')).toBe('');
    });

    it('should not remove lowercase placeholders', () => {
      expect(appService.removePlaceholders('%name%')).toBe('%name%');
    });

    it('should remove placeholders with underscores', () => {
      expect(appService.removePlaceholders('Hi %FIRST_NAME%!')).toBe('Hi !');
    });
  });

  describe('logInfo', () => {
    it('should log when LOG_LEVEL is INFO', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      process.env.LOG_LEVEL = 'INFO';

      appService.logInfo('test message');

      expect(spy).toHaveBeenCalledWith('test message', '');
      spy.mockRestore();
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      process.env.LOG_LEVEL = 'DEBUG';

      appService.logInfo('test', 'args');

      expect(spy).toHaveBeenCalledWith('test', 'args');
      spy.mockRestore();
    });

    it('should not log when LOG_LEVEL is ERROR', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      process.env.LOG_LEVEL = 'ERROR';

      appService.logInfo('test');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should default to INFO when LOG_LEVEL is not set', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      delete process.env.LOG_LEVEL;

      appService.logInfo('test');

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
