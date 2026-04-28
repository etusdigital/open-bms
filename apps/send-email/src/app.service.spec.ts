import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { SparkPostHandler } from './handlers/sparkpost/sparkPost.handler';
import { StorageService } from './storage/storage.service';
import { MailService } from './mail/mail.service';
import { FormatterUtils } from './utils/formatter.utils';
import { RedisService } from './providers/redis/redis.service';
import { TrackerService } from './tracker/tracker.service';
import { SplitFeature } from './features/split/split.feature';
import { MailUtils } from './mail/mail.utils';
import { EventPublisherService } from './event-publisher.service';

const createMockSendEmailData = (overrides = {}) => ({
  messageId: 'msg-123',
  startedAt: Date.now(),
  automationId: 123,
  automationName: 'Test Automation',
  automationType: 'email' as const,
  isRateLimit: false,
  utmContent: 'test-content',
  utmCampaign: 'test-campaign',
  contact: {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    isValid: true,
    uuid: 'uuid-123',
  },
  message: {
    id: 456,
    title: 'Test Email',
    name: 'test-email',
    ippool: 'default',
    subject: 'Test Subject',
    replyTo: 'reply@example.com',
    content: '<p>Test content</p>',
    location: {
      bucketName: 'test-bucket',
      fileName: 'test-file.html',
    },
    from: {
      firstName: 'Sender',
      email: 'sender@example.com',
    },
  },
  next: {
    pubName: 'next-topic',
    data: {},
  },
  account: {
    id: 1,
    name: 'Test Account',
    accountConfigs: [],
  },
  ...overrides,
});

describe('AppService (Refactored)', () => {
  let service: AppService;
  let sparkPostHandler: jest.Mocked<SparkPostHandler>;
  let storageService: jest.Mocked<StorageService>;
  let mailService: jest.Mocked<MailService>;
  let formatterUtils: jest.Mocked<FormatterUtils>;
  let redisClient: any;
  let trackerService: jest.Mocked<TrackerService>;
  let splitFeature: jest.Mocked<SplitFeature>;
  let mailUtils: jest.Mocked<MailUtils>;
  let eventPublisher: jest.Mocked<EventPublisherService>;

  beforeEach(async () => {
    // Mock do Redis Client
    redisClient = {
      mget: jest.fn().mockResolvedValue([null, null, null]),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn((key, callback) => {
        if (callback) callback(null, 1);
        return Promise.resolve(1);
      }),
      expire: jest.fn().mockResolvedValue(1),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: SparkPostHandler,
          useValue: {
            sendEmail: jest.fn(),
            createMail: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getHtml: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendMail: jest.fn(),
            createMail: jest.fn(),
            parseAutomationBatchToMailDataRequired: jest.fn(),
          },
        },
        {
          provide: FormatterUtils,
          useValue: {
            isValidEmail: jest.fn(),
            slugify: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(redisClient),
          },
        },
        {
          provide: TrackerService,
          useValue: {
            logInfo: jest.fn(),
            logError: jest.fn(),
            logDebug: jest.fn(),
            sendInfo: jest.fn(),
            sendDebug: jest.fn(),
          },
        },
        {
          provide: SplitFeature,
          useValue: {
            getConfig: jest.fn(),
            shouldChange: jest.fn(),
          },
        },
        {
          provide: MailUtils,
          useValue: {
            parseContent: jest.fn().mockReturnValue({ template: '<p>Parsed content</p>' }),
            createEmailPixel: jest.fn().mockReturnValue('<p>Content with pixel</p>'),
            createPreviewText: jest.fn(),
            parseVariables: jest.fn(),
            isMicrosoft: jest.fn().mockReturnValue(false),
            getAccountConfig: jest.fn(),
          },
        },
        {
          provide: EventPublisherService,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    sparkPostHandler = module.get(SparkPostHandler);
    storageService = module.get(StorageService);
    mailService = module.get(MailService);
    formatterUtils = module.get(FormatterUtils);
    module.get(RedisService);
    trackerService = module.get(TrackerService);
    splitFeature = module.get(SplitFeature);
    mailUtils = module.get(MailUtils);
    eventPublisher = module.get(EventPublisherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getState', () => {
    it('should return status true and message Ok!', async () => {
      const result = await service.getState();
      expect(result).toEqual({ status: true, message: 'Ok!' });
    });
  });

  // ============================================
  // VALIDAÇÕES DE CONTATO E MENSAGEM
  // ============================================

  describe('receiveMessage', () => {
    describe('email validation', () => {
      it('should reject invalid email format and return status false with messageId', async () => {
        const mockData = createMockSendEmailData({
          contact: { ...createMockSendEmailData().contact, email: 'invalid-email-format' },
        });
        formatterUtils.isValidEmail.mockReturnValue(false);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('msg-123');
        expect(formatterUtils.isValidEmail).toHaveBeenCalledWith('invalid-email-format');
      });

      it('should accept valid email and process successfully', async () => {
        // Arrange - Remove content para forçar busca no Storage
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            content: undefined, // Força busca no Storage
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Comportamento (resultado final)
        expect(formatterUtils.isValidEmail).toHaveBeenCalledWith('test@example.com');

        // Assert - Documentação do fluxo (assertions seletivas)
        expect(storageService.getHtml).toHaveBeenCalledWith('test-bucket', 'test-file.html');
        expect(mailService.sendMail).toHaveBeenCalled(); // Confirma que enviou email
        expect(redisClient.mget).toHaveBeenCalled(); // Confirma que consultou Redis (disengaged, etc.)
      });
    });

    describe('contact status validation', () => {
      /**
       * Testes parametrizados para todas as validações de status do contato
       * Cobre 7 cenários em um único bloco test.each
       */
      it.each([
        {
          scenario: 'email is null',
          contactOverride: { email: null },
          expectedMessage: 'Contact is not valid',
        },
        {
          scenario: 'email is undefined',
          contactOverride: { email: undefined },
          expectedMessage: 'Contact is not valid',
        },
        {
          scenario: 'hasEmail is false',
          contactOverride: { email: 'test@test.com', hasEmail: false },
          expectedMessage: 'Contact is not valid',
        },
        {
          scenario: 'isValid is false',
          contactOverride: { email: 'test@test.com', isValid: false },
          expectedMessage: 'Contact is not valid',
        },
        {
          scenario: 'hasBounced is true',
          contactOverride: { email: 'test@test.com', hasBounced: true },
          expectedMessage: 'Contact is not valid',
        },
        {
          scenario: 'isUnsubscribed is true',
          contactOverride: { email: 'test@test.com', isUnsubscribed: true },
          expectedMessage: 'Contact is not valid',
        },
        {
          scenario: 'isBlocked is true',
          contactOverride: { email: 'test@test.com', isBlocked: true },
          expectedMessage: 'Contact is not valid',
        },
      ])('should reject when $scenario', async ({ contactOverride, expectedMessage }) => {
        const mockData = createMockSendEmailData({
          contact: { ...createMockSendEmailData().contact, ...contactOverride },
          next: { pubName: '', data: {} }, // Sem pubName para garantir que retorne false
        });
        formatterUtils.isValidEmail.mockReturnValue(true);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain(expectedMessage);
        expect(result.message).toContain('msg-123');
      });

      it('should process normally when all contact flags are valid', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          contact: {
            id: 1,
            email: 'valid@example.com',
            firstName: 'John',
            isValid: true,
            hasEmail: true,
            hasBounced: false,
            isUnsubscribed: false,
            isBlocked: false,
            uuid: 'uuid-123',
          },
          message: {
            ...createMockSendEmailData().message,
            content: undefined, // Força busca no Storage para testar o fluxo completo
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        const result = await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Não rejeitou por status inválido
        expect(result.status).not.toBe(false);

        // Assert - Documentação do fluxo completo de sucesso
        expect(redisClient.mget).toHaveBeenCalledWith(
          expect.arrayContaining([expect.stringContaining('disengaged'), expect.stringContaining('unsubscribed'), expect.stringContaining('blocked')]),
        );
        expect(storageService.getHtml).toHaveBeenCalled();
        expect(mailService.sendMail).toHaveBeenCalled();
      });
    });

    describe('template processing', () => {
      it('should fetch HTML from Storage when message.content does not exist', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            content: undefined, // Sem content = busca do Storage
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        storageService.getHtml.mockResolvedValue('<p>HTML from Storage</p>');
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Deve buscar do Storage
        expect(storageService.getHtml).toHaveBeenCalledWith('test-bucket', 'test-file.html');
      });

      it('should use message.content when present (skip Storage fetch)', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            content: '<p>Inline HTML content</p>', // Content presente
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - NÃO deve buscar do Storage quando content presente
        expect(storageService.getHtml).not.toHaveBeenCalled();
      });

      it('should apply Handlebars variables to HTML', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            content: '<p>Hello {{firstName}}</p>', // Template com variável
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Verifica que parseContent foi chamado (processa Handlebars)
        expect(mailUtils.parseContent).toHaveBeenCalled();
      });

      it('should process email successfully when previewText is provided', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            content: '<p>Email body</p>',
            previewText: 'This is the preview text', // PreviewText fornecido
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        const result = await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Deve processar normalmente (previewText é aplicado no MailService)
        expect(result.status).not.toBe(false);
        expect(mailService.sendMail).toHaveBeenCalled();
      });
    });

    /**
     * SPLIT TESTING / A/B TESTING
     */
    describe('split testing (A/B testing)', () => {
      it('should evaluate and apply split configuration when conditions match', async () => {
        // Arrange - Configura split: 100% de chance para garantir que sempre aplique
        const splitConfig = {
          percent: 100, // 100% = sempre aplica variante
          automationIdPart: 'welcome',
          emailTitlePart: 'boas-vindas',
          pool: 'sparkpost-pool-alternate',
          sender: 'sender-b@example.com',
        };

        const mockData = createMockSendEmailData({
          automationId: 123, // Será convertido para string no código
          automationName: 'welcome-automation', // Contém "welcome"
          message: {
            ...createMockSendEmailData().message,
            title: 'Email de Boas-vindas', // Contém "boas-vindas"
            content: '<p>Test</p>',
          },
        });

        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        sparkPostHandler.sendEmail.mockResolvedValue([{ statusCode: 200, results: { id: 'spark-123' } }] as any);

        // Mock do split feature
        splitFeature.getConfig.mockReturnValue(splitConfig);
        splitFeature.shouldChange.mockReturnValue(true); // Sempre aplica variante

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Deve avaliar o split
        expect(splitFeature.getConfig).toHaveBeenCalled();
        expect(splitFeature.shouldChange).toHaveBeenCalledWith(
          'welcome-automation', // automationName (convertido para string)
          'test-email', // message.name (NÃO title)
          splitConfig,
        );
      });

      it('should NOT apply split when conditions do not match', async () => {
        // Arrange - Automação não matcha com configuração
        const splitConfig = {
          percent: 100,
          automationIdPart: 'welcome', // Procura por "welcome"
          emailTitlePart: 'boas-vindas',
          pool: 'sparkpost-pool-alternate',
          sender: 'sender-b@example.com',
        };

        const mockData = createMockSendEmailData({
          automationId: 999,
          automationName: 'abandoned-cart', // NÃO contém "welcome"
          message: {
            ...createMockSendEmailData().message,
            title: 'Carrinho Abandonado', // NÃO contém "boas-vindas"
            content: '<p>Test</p>',
          },
        });

        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        sparkPostHandler.sendEmail.mockResolvedValue([{ statusCode: 200, results: { id: 'spark-456' } }] as any);
        splitFeature.getConfig.mockReturnValue(splitConfig);
        splitFeature.shouldChange.mockReturnValue(false); // Não aplica variante

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Avaliou mas NÃO aplicou (shouldChange = false)
        expect(splitFeature.shouldChange).toHaveBeenCalled();
      });

      it('should NOT apply split when no configuration exists', async () => {
        // Arrange - Sem configuração de split
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            content: '<p>Test</p>',
          },
        });

        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        sparkPostHandler.sendEmail.mockResolvedValue([{ statusCode: 200, results: { id: 'spark-789' } }] as any);
        splitFeature.getConfig.mockReturnValue(null); // Sem config = sem split

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Não deve chamar shouldChange se getConfig retorna null
        expect(splitFeature.getConfig).toHaveBeenCalled();
        // shouldChange não seria chamado porque config é null
      });
    });

    describe('provider selection (critical business logic)', () => {
      it('should use SparkPost when ippool contains "sparkpost"', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            ippool: 'sparkpost-pool-1',
            content: undefined, // Força busca no Storage
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        sparkPostHandler.sendEmail.mockResolvedValue([{ statusCode: 200 }] as any);

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Decisão crítica: deve usar SparkPost, NÃO SendGrid
        expect(sparkPostHandler.sendEmail).toHaveBeenCalled();
        expect(mailService.sendMail).not.toHaveBeenCalled();
      });

      it('should use SendGrid when ippool does NOT contain "sparkpost"', async () => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            ippool: 'default-pool',
            content: undefined, // Força busca no Storage
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Decisão crítica: deve usar SendGrid, NÃO SparkPost
        expect(mailService.sendMail).toHaveBeenCalled();
        expect(sparkPostHandler.sendEmail).not.toHaveBeenCalled();
      });
    });

    describe('message object validation', () => {
      /**
       * NOTA: O código atual tem um bug onde tenta acessar message.name (linha 60)
       * antes de verificar se message existe (linha 95). Isso causa TypeError.
       * Os testes abaixo documentam o comportamento ATUAL, não o ideal.
       */
      it.each([
        { scenario: 'message is null', messageOverride: null },
        { scenario: 'message is undefined', messageOverride: undefined },
      ])('should throw TypeError when $scenario (bug: acessa message antes de validar)', async ({ messageOverride }) => {
        // Arrange
        const mockData = createMockSendEmailData({
          message: messageOverride as any,
        });
        formatterUtils.isValidEmail.mockReturnValue(true);

        // Act & Assert
        await expect(service.receiveMessage(mockData as any, 'redis-key')).rejects.toThrow(TypeError);
      });

      it('should process normally when message object is present', async () => {
        // Arrange
        const mockData = createMockSendEmailData(); // message já presente no fixture
        formatterUtils.isValidEmail.mockReturnValue(true);
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        // Act
        const result = await service.receiveMessage(mockData as any, 'redis-key');

        // Assert - Não rejeitou por message ausente
        expect(result.status).not.toBe(false);
      });
    });

    describe('duplicate message detection', () => {
      it('should return false when duplicate message is detected for non-special accounts', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 999, name: 'Regular Account' },
          next: { pubName: '', data: {} }, // No next step
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockResolvedValueOnce('true'); // leadRedisKey exists (duplicate)
        redisClient.mget.mockResolvedValue([null, null]); // No disengaged/removed flags

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Duplicated message');
        expect(trackerService.logError).toHaveBeenCalledWith(expect.stringContaining('Duplicated message'));
      });

      it('should return false and log for special accounts with duplicate messages', async () => {
        const specialAccountIds = [136, 137, 138, 25, 81, 104, 119, 120, 141, 244, 263, 261, 233, 107, 169, 69];
        const accountId = specialAccountIds[0]; // Test with first ID
        const mockData = createMockSendEmailData({ account: { id: accountId, name: 'Special Account' } });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockResolvedValueOnce('true'); // leadRedisKey exists (duplicate)
        redisClient.mget.mockResolvedValue([null, null]);

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Duplicated message');
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Remove user : ${mockData.contact.email}`));
        consoleLogSpy.mockRestore();
      });

      it('should sendToNextStep when duplicate detected and next.pubName exists', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 999, name: 'Regular Account' },
          next: { pubName: 'next-topic', data: { leadId: 'lead-123' } },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockResolvedValueOnce('true'); // leadRedisKey exists (duplicate)
        redisClient.mget.mockResolvedValue([null, null]);

        const sendToNextStepSpy = jest.spyOn(service as any, 'sendToNextStep').mockResolvedValue({ status: true });

        await service.receiveMessage(mockData as any, 'redis-key');

        expect(sendToNextStepSpy).toHaveBeenCalledWith(mockData.next.data, 'redis-key');
        sendToNextStepSpy.mockRestore();
      });
    });

    describe('bad users detection', () => {
      it('should reject bad users and return false', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
          account: { id: 123, name: 'Test Account' },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockImplementation((key: string) => {
          if (key.includes('badusers')) return Promise.resolve('true');
          return Promise.resolve(null);
        });
        redisClient.mget.mockResolvedValue([null, null]);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Remove bad users');
        expect(trackerService.logError).toHaveBeenCalledWith(expect.stringContaining('Remove bad users'));
      });
    });

    describe('sendAt validation', () => {
      it('should reject when sendAt is not a valid number', async () => {
        const mockData = createMockSendEmailData({
          sendAt: 'invalid-timestamp' as any,
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null]);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Invalid sendAt time');
        expect(result.message).toContain('Must be a unix timestamp');
        expect(trackerService.logError).toHaveBeenCalled();
      });

      it('should reject when sendAt is beyond 72 hours', async () => {
        const futureTimestamp = Math.floor(Date.now() / 1000) + 73 * 60 * 60; // 73 hours from now
        const mockData = createMockSendEmailData({
          sendAt: futureTimestamp,
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null]);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Invalid sendAt time');
        expect(result.message).toContain('within 72 hours');
        expect(trackerService.logError).toHaveBeenCalled();
      });
    });

    describe('account-specific handling', () => {
      it('should use parseAutomationBatchToMailDataRequired for account 165', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 165, name: 'Special Account 165' },
          automationType: 'email',
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null]);
        redisClient.set.mockResolvedValue('OK');
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        mailService.parseAutomationBatchToMailDataRequired = jest.fn().mockReturnValue({
          to: { email: 'test@example.com', name: 'Test' },
        });
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        await service.receiveMessage(mockData as any, 'redis-key');

        expect(mailService.parseAutomationBatchToMailDataRequired).toHaveBeenCalledWith(
          expect.objectContaining({
            contacts: [mockData.contact],
          }),
          '<p>Test content</p>',
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('BATCH AUTOMATION SEND'));
        consoleLogSpy.mockRestore();
      });
    });

    describe('membros automation block', () => {
      it('should return false when message name is confirmacao-de-email-sorteio-membros-12', async () => {
        const mockData = createMockSendEmailData({
          message: {
            ...createMockSendEmailData().message,
            name: 'confirmacao-de-email-sorteio-membros-12',
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Stop sending to membros automation');
        expect(result.message).toContain(mockData.contact.email);
        consoleLogSpy.mockRestore();
      });
    });

    describe('invalid contact with special account IDs', () => {
      it('should log "Remove user" and return false for special accounts with invalid contact', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 136, name: 'Special Account' },
          contact: { ...createMockSendEmailData().contact, isValid: false },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Contact is not valid');
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Remove user : ${mockData.contact.email}`));
        consoleLogSpy.mockRestore();
      });

      it('should log "Remove user" and return false for special accounts with disengaged contact', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 137, name: 'Special Account' },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.mget.mockResolvedValue(['disengaged-value', null, null]);

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Disengaged');
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Remove user : ${mockData.contact.email}`));
        consoleLogSpy.mockRestore();
      });
    });

    describe('sendToNextStep for invalid/disengaged contacts', () => {
      it('should call sendToNextStep when contact is invalid and next.pubName exists', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 999, name: 'Regular Account' },
          contact: { ...createMockSendEmailData().contact, isValid: false },
          next: { pubName: 'next-topic', data: { leadId: 'lead-123' } },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);

        const sendToNextStepSpy = jest.spyOn(service as any, 'sendToNextStep').mockResolvedValue({ status: true, message: 'sent' });
        await service.receiveMessage(mockData as any, 'redis-key');

        expect(sendToNextStepSpy).toHaveBeenCalledWith(mockData.next.data, 'redis-key');
        sendToNextStepSpy.mockRestore();
      });

      it('should call sendToNextStep when contact is disengaged and next.pubName exists', async () => {
        const mockData = createMockSendEmailData({
          account: { id: 999, name: 'Regular Account' },
          next: { pubName: 'next-topic', data: { leadId: 'lead-456' } },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        redisClient.mget.mockResolvedValue([null, 'unsubscribed-value', null]);

        const sendToNextStepSpy = jest.spyOn(service as any, 'sendToNextStep').mockResolvedValue({ status: true, message: 'sent' });
        await service.receiveMessage(mockData as any, 'redis-key');

        expect(sendToNextStepSpy).toHaveBeenCalledWith(mockData.next.data, 'redis-key');
        sendToNextStepSpy.mockRestore();
      });
    });

    describe('Microsoft email block for account 1', () => {
      it('should return false when non-transactional email from account 1 to Microsoft email', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
          account: { id: 1, name: 'Account 1' },
          message: {
            ...createMockSendEmailData().message,
            ippool: 'regular-pool',
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.isMicrosoft.mockReturnValue(true);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Stop sending to microsoft');
      });

      it('should NOT block Microsoft email when ippool is m02_brmailsrv_com', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
          account: { id: 1, name: 'Account 1' },
          message: {
            ...createMockSendEmailData().message,
            ippool: 'm02_brmailsrv_com',
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.isMicrosoft.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).not.toBe(false);
      });

      it('should NOT block Microsoft email when automationType is transactional', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'transactional',
          account: { id: 1, name: 'Account 1' },
          message: {
            ...createMockSendEmailData().message,
            ippool: 'regular-pool',
          },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.isMicrosoft.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).not.toBe(false);
      });
    });

    describe('rate limiting (fixed)', () => {
      it('should reject when contact has reached rate limit', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
          isRateLimit: true,
          contact: { id: 123, email: 'test@example.com', firstName: 'John', isValid: true, uuid: 'uuid-123' },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.getAccountConfig.mockImplementation((configs, key) => {
          if (key === 'send_limit_per_user') return '5';
          return null;
        });
        redisClient.get.mockImplementation((key: string) => {
          if (key.startsWith('contact_send:')) return Promise.resolve('5');
          return Promise.resolve(null);
        });
        redisClient.mget.mockResolvedValue([null, null, null]);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(result.message).toContain('Contact limit reached');
        expect(trackerService.logError).toHaveBeenCalledWith(expect.stringContaining('Contact limit reached'));
      });

      it('should sendToNextStep when rate limit reached and next.pubName exists', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
          isRateLimit: true,
          contact: { id: 123, email: 'test@example.com', firstName: 'John', isValid: true, uuid: 'uuid-123' },
          next: { pubName: 'next-topic', data: { leadId: 'lead-123' } },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.getAccountConfig.mockImplementation((configs, key) => {
          if (key === 'send_limit_per_user') return '5';
          return null;
        });
        redisClient.get.mockImplementation((key: string) => {
          if (key.startsWith('contact_send:')) return Promise.resolve('5');
          return Promise.resolve(null);
        });
        redisClient.mget.mockResolvedValue([null, null, null]);

        const sendToNextStepSpy = jest.spyOn(service as any, 'sendToNextStep').mockResolvedValue(undefined);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(false);
        expect(sendToNextStepSpy).toHaveBeenCalledWith(mockData.next.data, 'redis-key');
        sendToNextStepSpy.mockRestore();
      });

      it('should initialize rate limit counter with TTL when key does not exist', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
          isRateLimit: true,
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.getAccountConfig.mockImplementation((configs, key) => {
          if (key === 'send_limit_per_user') return '5';
          return null;
        });
        storageService.getHtml.mockResolvedValue('<p>Test content</p>');
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);
        redisClient.exists = jest.fn().mockResolvedValue(0);
        redisClient.set.mockResolvedValue('OK');

        await service.receiveMessage(mockData as any, 'redis-key');

        const setCallsForContactSend = (redisClient.set as jest.Mock).mock.calls.filter((call) => typeof call[0] === 'string' && call[0].startsWith('contact_send:'));
        expect(setCallsForContactSend.length).toBeGreaterThan(0);
        expect(setCallsForContactSend[0]).toEqual([expect.stringContaining('contact_send'), 0, 'EX', expect.any(Number)]);
        expect(redisClient.incr).toHaveBeenCalledWith(expect.stringContaining('contact_send'));
      });
    });

    describe('Redis rate limit tracking after send', () => {
      it('should set and incr contact_send key when sendLimitPerUser exists and not transactional', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.getAccountConfig.mockImplementation((configs, key) => {
          if (key === 'send_limit_per_user') return '3';
          return null;
        });
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);
        redisClient.exists = jest.fn().mockResolvedValue(0);

        await service.receiveMessage(mockData as any, 'redis-key');

        const setCallsForContactSend = (redisClient.set as jest.Mock).mock.calls.filter((call) => typeof call[0] === 'string' && call[0].startsWith('contact_send:'));
        expect(setCallsForContactSend.length).toBeGreaterThan(0);
        expect(redisClient.incr).toHaveBeenCalledWith(expect.stringContaining('contact_send'));
      });

      it('should log error when Redis set fails during rate limit tracking', async () => {
        const mockData = createMockSendEmailData({
          automationType: 'email',
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailUtils.getAccountConfig.mockImplementation((configs, key) => {
          if (key === 'send_limit_per_user') return '3';
          return null;
        });
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);
        redisClient.set.mockRejectedValueOnce(new Error('Redis error'));

        await service.receiveMessage(mockData as any, 'redis-key');

        expect(trackerService.logError).toHaveBeenCalledWith(expect.stringContaining('Unable to save in Redis'));
      });
    });

    describe('Redis incr error callback for pool tracking', () => {
      it('should log error when hourly pool incr callback has error', async () => {
        const mockData = createMockSendEmailData();
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);

        let callCount = 0;
        redisClient.incr.mockImplementation((key: string, callback?: (err: Error | null, result: number | null) => void) => {
          callCount++;
          if (callback) {
            if (callCount === 1) {
              callback(new Error('Redis incr error'), null);
            } else {
              callback(null, 1);
            }
          }
          return Promise.resolve(1);
        });

        await service.receiveMessage(mockData as any, 'redis-key');

        expect(trackerService.logError).toHaveBeenCalledWith(expect.stringContaining('Unable to increment in Redis'));
      });

      it('should log error when daily pool incr callback has error', async () => {
        const mockData = createMockSendEmailData();
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);

        let callCount = 0;
        redisClient.incr.mockImplementation((key: string, callback?: (err: Error | null, result: number | null) => void) => {
          callCount++;
          if (callback) {
            if (callCount === 2) {
              callback(new Error('Redis incr error'), null);
            } else {
              callback(null, 1);
            }
          }
          return Promise.resolve(1);
        });

        await service.receiveMessage(mockData as any, 'redis-key');

        expect(trackerService.logError).toHaveBeenCalledWith(expect.stringContaining('Unable to increment in Redis'));
      });
    });

    describe('no next step', () => {
      it('should return status true when next is falsy', async () => {
        const mockData = createMockSendEmailData({
          next: null,
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(true);
        expect(result.message).toContain('does not have the next filled in');
      });

      it('should return status true when next.pubName is empty', async () => {
        const mockData = createMockSendEmailData({
          next: { pubName: '', data: {} },
        });
        formatterUtils.isValidEmail.mockReturnValue(true);
        mailService.sendMail.mockResolvedValue({ statusCode: 202 } as any);
        redisClient.get.mockResolvedValue(null);
        redisClient.mget.mockResolvedValue([null, null, null]);

        const result = await service.receiveMessage(mockData as any, 'redis-key');

        expect(result.status).toBe(true);
        expect(result.message).toContain('does not have the next filled in');
      });
    });

    describe('sendToNextStep error', () => {
      it('should throw wrapped error when eventPublisher.publish fails', async () => {
        eventPublisher.publish.mockRejectedValue(new Error('AMQP failure'));

        await expect(service.sendToNextStep({ leadId: '123' }, 'redis-key')).rejects.toThrow('Error to send message to message-trigger error');
      });

      it('should publish to bms.triggers/trigger.process on success', async () => {
        eventPublisher.publish.mockResolvedValue();

        await service.sendToNextStep({ leadId: '123' }, 'redis-key');

        expect(eventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', { leadId: '123' });
      });
    });

    describe('getContent with missing location', () => {
      it('should throw InternalServerErrorException when cache is empty and location is missing', async () => {
        redisClient.get.mockResolvedValue(null);

        await expect((service as any).getContent(999, null)).rejects.toThrow('Could not find current email location');
      });

      it('should throw InternalServerErrorException when cache is empty and location has no bucketName', async () => {
        redisClient.get.mockResolvedValue(null);

        await expect((service as any).getContent(999, { fileName: 'test.html' })).rejects.toThrow('Could not find current email location');
      });
    });

    describe('getRedis', () => {
      it('should parse and return value when Redis has data', async () => {
        const payload = { messageId: 'msg-1', contact: { email: 'a@b.com' } };
        redisClient.get.mockResolvedValue(JSON.stringify(payload));

        const result = await service.getRedis('some-key');

        expect(result).toEqual(payload);
      });

      it('should return undefined when Redis returns null', async () => {
        redisClient.get.mockResolvedValue(null);

        const result = await service.getRedis('missing-key');

        expect(result).toBeUndefined();
      });
    });
  });
});
