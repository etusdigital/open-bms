import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '../storage/storage.service';
import { FormatterUtils } from '../utils/formatter.utils';
import { Batch } from './mail.interface';
import { MailService } from './mail.service';
import { MailUtils } from './mail.utils';
import { TrackerService } from '../tracker/tracker.service';
import { SparkPostHandler } from '../handlers/sparkpost/sparkPost.handler';
import { SendGridHandler } from '../handlers/sendgrid/sendGrid.handler';
import { HtmlToTextService } from '../html-to-text/html-to-text.service';
import { CampaignType, CampaignMessageType, CampaignStatus } from '../interfaces';
import * as sendgrid from '@sendgrid/mail';

/**
 * Factory function to create mock Batch data
 */
const createMockBatch = (overrides: Partial<Batch> = {}): any => ({
  campaign_id: 123,
  campaign_name: 'Test Campaign',
  campaign_test_ab_mode: false,
  page: 1,
  totalPages: 1,
  account: {
    id: 1,
    name: 'Test Account',
    accountConfigs: [
      { accountId: 1, name: 'sendgrid_key', value: 'SG.AccountSpecificKey' },
      { accountId: 1, name: 'sendgrid_unsubscribed_group', value: '12345' },
    ],
    customFields: [
      { id: 124, accountId: 1, title: 'Renda', name: 'RENDA', description: '', order: 2 },
      { id: 125, accountId: 1, title: 'Grupo', name: 'GRUPO', description: '', order: 2 },
    ],
  },
  campaign: {
    id: 123,
    title: 'Test Campaign',
    name: 'test-campaign',
    accountId: 1,
    status: CampaignStatus.Draft,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    spreadSending: 0,
    query: '',
    steps: '',
    account: { id: 1 },
    type: CampaignType.SIMPLE,
    messageType: CampaignMessageType.EMAIL,
    isWarmup: false,
    isRateLimit: true,
  },
  contacts: [
    {
      id: 1,
      email: 'user1@example.com',
      firstName: 'User',
      isValid: true,
      uuid: 'uuid-1',
      customFields: {
        RENDA: 'renda_value',
        GRUPO: 'grupo_value',
      },
    },
    {
      id: 2,
      email: 'user2@example.com',
      firstName: 'User2',
      isValid: true,
      uuid: 'uuid-2',
      customFields: {
        RENDA: 'renda_value2',
        GRUPO: 'grupo_value2',
      },
    },
  ],
  message: {
    id: 1,
    title: 'Test Email',
    name: 'test-email',
    fromMail: 'sender@example.com',
    fromName: 'Sender Name',
    ippool: 'default-pool',
    replyTo: 'reply@example.com',
    subject: 'Test Subject',
    bucketName: 'test-bucket',
    fileName: 'test-file.html',
    content: '<p>Hello %FIRSTNAME%, link: [unsubscribe_link]</p>',
    previewText: 'Preview text',
  },
  ...overrides,
});

const createMockAutomationBatch = (overrides = {}): any => ({
  messageId: 'msg-123',
  startedAt: Date.now(),
  automationId: 456,
  automationName: 'Test Automation',
  automationType: 'email' as const,
  isRateLimit: false,
  utmContent: 'test-content',
  utmCampaign: 'test-campaign',
  sendAt: Date.now(),
  contacts: [
    { id: 1, email: 'user1@example.com', firstName: 'User', isValid: true, uuid: 'uuid-1' },
    { id: 2, email: 'user2@example.com', firstName: 'User2', isValid: true, uuid: 'uuid-2' },
  ],
  message: {
    id: 1,
    title: 'Test Email',
    name: 'test-email',
    ippool: 'default-pool',
    subject: 'Test Subject',
    replyTo: 'reply@example.com',
    priority: 'normal',
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
  next: { pubName: '', data: {} as any },
  account: {
    id: 1,
    name: 'Test Account',
    accountConfigs: [],
  },
  ...overrides,
});

const mockEmailContent = `<p><span style=\"font-family: Arial; font-size: 18px;\">Boa noite %FIRSTNAME%,</span></p><p><span style=\"font-family: Arial; font-size: 18px;\">Shun Email Teste %FIRSTNAME%</span></p>`;

describe('MailService', () => {
  let service: MailService;
  let formatterUtils: FormatterUtils;
  let mailUtils: MailUtils;
  let sparkPostHandler: SparkPostHandler;
  let sendGridHandler: SendGridHandler;
  let storageService: StorageService;
  let sendgridSendMock: jest.Mock;

  // After Phase 1 refactor MailService.sendBatch receives a pre-resolved provider
  // (the routing decision lives in EmailProviderRouter, exercised separately).
  // This helper preserves the spec's original "ippool drives provider" intent.
  const providerFor = (batch: any) => ((batch?.message?.ippool || '').includes('sparkpost') ? sparkPostHandler : sendGridHandler);

  beforeEach(async () => {
    sendgridSendMock = jest.fn().mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: FormatterUtils,
          useValue: {
            isValidEmail: jest.fn().mockReturnValue(true),
            slugify: jest.fn((text) => text?.toLowerCase().replace(/\s+/g, '-')),
            normalizeString: jest.fn((text) => text),
          },
        },
        {
          provide: HtmlToTextService,
          useValue: {
            convert: jest.fn((_text) => 'abc'),
          },
        },
        {
          provide: MailUtils,
          useValue: {
            getAccountConfig: jest.fn((configs, key) => {
              const config = configs?.find((c) => c.name === key);
              return config?.value;
            }),
            parseContent: jest.fn().mockReturnValue({ template: '<p>Parsed</p>' }),
            createEmailPixel: jest.fn((params) => ({
              emailContent: params?.emailContent || '<p>Email with pixel</p>',
              template: params?.emailContent || '<p>Email with pixel</p>',
              replaceLinks: [],
            })),
            isMicrosoft: jest.fn().mockReturnValue(false),
            getCategories: jest.fn((batch) => {
              // Include messageId for automation batches
              if (batch && batch.messageId) {
                return ['category1', batch.messageId];
              }
              return ['category1'];
            }),
            getCategoriesCampaign: jest.fn().mockReturnValue(['campaign-category']),
            getIppol: jest.fn((_message) => _message?.ippool || 'default-pool'),
            parseHandlebarsVariables: jest.fn((html, _account) => html),
            createPreviewText: jest.fn((html, _previewText) => html),
            getPersonalization: jest.fn((contact, _customFields) => ({
              to: [{ email: contact.email, name: contact.firstName }],
              substitutions: {
                FIRSTNAME: contact.firstName,
                ...contact.customFields,
              },
            })),
            mapVariables: jest.fn((contact, _account, _message, _replaceLinks, _isAutomation) => ({
              FIRSTNAME: contact.firstName || '',
              ...contact.customFields,
            })),
          },
        },
        {
          provide: SparkPostHandler,
          useValue: {
            createCampaignBatchMail: jest.fn().mockReturnValue({}),
            createAutomationBatchMail: jest.fn().mockReturnValue({}),
            sendEmail: jest.fn().mockResolvedValue([{ statusCode: 200, results: { id: 'spark-123' } }]),
            getMetadata: jest.fn().mockReturnValue({ name: 'sparkpost', hasFreeTier: true, hasWebhook: true }),
            createMail: jest.fn().mockReturnValue({}),
          },
        },
        // Real SendGridHandler so existing assertions about SendGrid SDK calls
        // (sendgrid.send, sendgrid.setApiKey) keep working after MailService
        // was refactored to delegate to it.
        SendGridHandler,
        {
          provide: StorageService,
          useValue: {
            getHtml: jest.fn().mockResolvedValue('<p>HTML from storage</p>'),
          },
        },
        {
          provide: TrackerService,
          useValue: {
            logDebug: jest.fn(),
            logInfo: jest.fn(),
            logError: jest.fn(),
          },
        },
      ],
    }).compile();

    module.get<HtmlToTextService>(HtmlToTextService);
    service = module.get<MailService>(MailService);
    formatterUtils = module.get<FormatterUtils>(FormatterUtils);
    mailUtils = module.get<MailUtils>(MailUtils);
    sparkPostHandler = module.get<SparkPostHandler>(SparkPostHandler);
    sendGridHandler = module.get<SendGridHandler>(SendGridHandler);
    storageService = module.get<StorageService>(StorageService);
    module.get<TrackerService>(TrackerService);

    // Mock SendGrid
    jest.spyOn(sendgrid, 'setApiKey').mockImplementation(() => {});
    jest.spyOn(sendgrid, 'send').mockImplementation(sendgridSendMock as any);

    // Set environment variable
    process.env.SENDGRID_API_KEY = 'SG.DefaultTestKey';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // describe('sendMail - Unsubscribe Group Management', () => {
  //   it('should configure mail.asm when unsubscribe group is set', async () => {
  //     const mockMail = {
  //       to: 'test@example.com',
  //       from: 'sender@example.com',
  //       subject: 'Test',
  //       content: [{ type: 'text/html', value: '<p>Test <a href="[unsubscribe_link]">Unsubscribe</a></p>' }],
  //       categories: [],
  //       ipPoolName: 'default',
  //     } as any;

  //     const account = createMockBatch().account;

  //     await service.sendMail(mockMail, account);

  //     expect(mockMail.asm).toEqual({ groupId: 12345 });
  //   });

  //   it('should replace [unsubscribe_link] with SendGrid tag', async () => {
  //     const mockMail = {
  //       to: 'test@example.com',
  //       from: 'sender@example.com',
  //       subject: 'Test',
  //       content: [{ type: 'text/html', value: '<p>Test <a href="[unsubscribe_link]">Unsubscribe</a></p>' }],
  //       categories: [],
  //       ipPoolName: 'default',
  //     } as any;

  //     const account = createMockBatch().account;

  //     await service.sendMail(mockMail, account);

  //     expect(mockMail.content[0].value).toContain('href="<%asm_preferences_raw_url%>"');
  //     expect(mockMail.content[0].value).not.toContain('[unsubscribe_link]');
  //   });

  //   it('should omit asm when unsubscribe group not configured', async () => {
  //     const mockMail = {
  //       to: 'test@example.com',
  //       from: 'sender@example.com',
  //       subject: 'Test',
  //       content: [{ type: 'text/html', value: '<p>Test</p>' }],
  //       categories: [],
  //       ipPoolName: 'default',
  //     } as any;

  //     const account = {
  //       id: 1,
  //       accountConfigs: [],
  //     };

  //     await service.sendMail(mockMail, account as any);

  //     expect(mockMail.asm).toBeUndefined();
  //   });

  //   it('should convert groupId to Number', async () => {
  //     const mockMail = {
  //       to: 'test@example.com',
  //       from: 'sender@example.com',
  //       subject: 'Test',
  //       content: [{ type: 'text/html', value: '<p>Test</p>' }],
  //       categories: [],
  //       ipPoolName: 'default',
  //     } as any;

  //     const account = createMockBatch().account;

  //     await service.sendMail(mockMail, account);

  //     expect(typeof mockMail.asm.groupId).toBe('number');
  //     expect(mockMail.asm.groupId).toBe(12345);
  //   });
  // });

  describe('sendMail - Debug Mode', () => {
    it('should return mail object without sending when debug is true', async () => {
      const mockMail = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        content: [{ type: 'text/html', value: '<p>Test</p>' }],
        categories: [],
      } as any;

      const result = await service.sendMail(mockMail, null, false, 'true');

      expect(result).toEqual(mockMail);
      expect(sendgridSendMock).not.toHaveBeenCalled();
    });

    it('should call sendgrid.send when debug is false', async () => {
      const mockMail = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        content: [{ type: 'text/html', value: '<p>Test</p>' }],
        categories: [],
        ipPoolName: 'default',
      } as any;

      const account = {
        id: 1,
        accountConfigs: [],
      };

      await service.sendMail(mockMail, account, false, null);

      expect(sendgridSendMock).toHaveBeenCalledWith(mockMail);
    });
  });

  describe('sendBatch - SparkPost Integration', () => {
    it('should detect SparkPost by ippool containing "sparkpost" for campaign', async () => {
      const batch = createMockBatch({
        message: { ...createMockBatch().message, ippool: 'sparkpost-pool-1' },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(sparkPostHandler.createCampaignBatchMail).toHaveBeenCalled();
      expect(sparkPostHandler.sendEmail).toHaveBeenCalled();
      expect(sendgridSendMock).not.toHaveBeenCalled();
    });

    it('should detect SparkPost by ippool containing "sparkpost" for automation', async () => {
      const batch = createMockAutomationBatch({
        message: {
          ...createMockAutomationBatch().message,
          ippool: 'sparkpost-pool-automation',
        },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(sparkPostHandler.createAutomationBatchMail).toHaveBeenCalled();
      expect(sparkPostHandler.sendEmail).toHaveBeenCalled();
      expect(sendgridSendMock).not.toHaveBeenCalled();
    });

    it('should use SendGrid when ippool does NOT contain "sparkpost"', async () => {
      const batch = createMockBatch({
        message: { ...createMockBatch().message, ippool: 'sendgrid-pool' },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(sparkPostHandler.createCampaignBatchMail).not.toHaveBeenCalled();
      expect(sendgridSendMock).toHaveBeenCalled();
    });
  });

  describe('sendBatch - Content Fetching', () => {
    it('should use message.content when present for campaign', async () => {
      const batch = createMockBatch({
        message: {
          ...createMockBatch().message,
          content: '<p>Inline content</p>',
        },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(storageService.getHtml).not.toHaveBeenCalled();
    });

    it('should fetch from Storage when message.content is null for campaign', async () => {
      const batch = createMockBatch({
        message: {
          ...createMockBatch().message,
          content: null,
        },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(storageService.getHtml).toHaveBeenCalledWith('test-bucket', 'test-file.html');
    });

    it('should use message.location for automation when content is null', async () => {
      const batch = createMockAutomationBatch({
        message: {
          ...createMockAutomationBatch().message,
          content: null,
        },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(storageService.getHtml).toHaveBeenCalledWith('test-bucket', 'test-file.html');
    });
  });

  describe('parseBatchToMailDataRequired - Enhanced', () => {
    it('should create personalizations for each contact', () => {
      const batch = createMockBatch();
      const result = service.parseBatchToMailDataRequired(batch, '<p>HTML content</p>');

      expect(result.personalizations).toHaveLength(2);
      expect(result.personalizations[0].to[0].email).toBe('user1@example.com');
      expect(result.personalizations[1].to[0].email).toBe('user2@example.com');
    });

    it('should map custom fields correctly', () => {
      const batch = createMockBatch();
      const result = service.parseBatchToMailDataRequired(batch, '<p>%RENDA% %GRUPO%</p>');

      expect(result.personalizations[0].substitutions.RENDA).toBe('renda_value');
      expect(result.personalizations[0].substitutions.GRUPO).toBe('grupo_value');
    });

    it('should apply ipPoolName', () => {
      const batch = createMockBatch();
      const result = service.parseBatchToMailDataRequired(batch, '<p>HTML</p>');

      expect(result.ipPoolName).toBe('default-pool');
    });

    it('should configure tracking (open tracking)', () => {
      const batch = createMockBatch();
      const result = service.parseBatchToMailDataRequired(batch, '<p>HTML</p>');

      expect(result.trackingSettings).toBeDefined();
      expect(result.trackingSettings.openTracking).toBeDefined();
      expect(result.trackingSettings.openTracking.enable).toBe(true);
    });

    it('should include both text/plain and text/html content', () => {
      const batch = createMockBatch();
      batch.message.id = 519992;

      const data = service.parseBatchToMailDataRequired(batch, mockEmailContent);
      expect(data.content).toHaveLength(2);
      expect(data.content[0].type).toBe('text/plain');
      expect(data.content[1].type).toBe('text/html');
    });

    it('should parse contacts with a single email and variables', () => {
      const batch = createMockBatch();
      const data = service.parseBatchToMailDataRequired(batch, mockEmailContent);

      expect(data).toBeTruthy();
      expect(data.personalizations).toHaveLength(2);
    });

    it('should return personalizations with correct variables', () => {
      const batch = createMockBatch();
      const data = service.parseBatchToMailDataRequired(batch, mockEmailContent);
      expect(data.personalizations[0].substitutions.FIRSTNAME).toBe(batch.contacts[0].firstName);
    });

    // it('should return html without msgops variables', () => {
    //   const batch = createMockBatch();
    //   batch.message.id = 519992;

    //   const data = service.parseBatchToMailDataRequired(batch, mockEmailContent);
    //   // content[0] is text/plain, content[1] is text/html
    //   expect(data.content[1].value.includes('%')).toBeFalsy();
    // });
  });

  describe('parseAutomationBatchToMailDataRequired', () => {
    it('should include messageId in categories', () => {
      const batch = createMockAutomationBatch();
      const result = service.parseAutomationBatchToMailDataRequired(batch, '<p>HTML</p>');

      expect(result.categories).toContain('msg-123');
    });

    it('should process location.bucketName and location.fileName', () => {
      const batch = createMockAutomationBatch();

      // This test verifies the method handles location properly
      expect(() => service.parseAutomationBatchToMailDataRequired(batch, '<p>HTML</p>')).not.toThrow();
    });

    it('should apply ipPoolName from message', () => {
      const batch = createMockAutomationBatch();
      const result = service.parseAutomationBatchToMailDataRequired(batch, '<p>HTML</p>');

      expect(result.ipPoolName).toBe('default-pool');
    });

    it('should apply automation-specific variables', () => {
      const batch = createMockAutomationBatch();
      (mailUtils.mapVariables as jest.Mock).mockReturnValueOnce({
        FIRSTNAME: 'Auto',
        LASTNAME: 'User',
        EMAIL: 'auto1@test.com',
        customField1: 'value1',
      });

      const result = service.parseAutomationBatchToMailDataRequired(batch, '<p>Hello %FIRSTNAME%</p>');

      expect(result.personalizations[0].substitutions.FIRSTNAME).toBe('Auto');
      expect(mailUtils.mapVariables).toHaveBeenCalledWith(
        expect.any(Object),
        batch.account,
        batch.message,
        expect.any(Array),
        true, // isAutomation flag
      );
    });
  });

  describe('SparkPost Provider Detection', () => {
    it('should detect SparkPost by ippool containing "sparkpost"', async () => {
      const batch = createMockBatch({
        message: {
          ...createMockBatch().message,
          ippool: 'sparkpost-premium-pool',
        },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(sparkPostHandler.createCampaignBatchMail).toHaveBeenCalled();
      expect(sparkPostHandler.sendEmail).toHaveBeenCalled();
    });

    it('should use SparkPost handler for automation batch when ippool contains "sparkpost"', async () => {
      const batch = createMockAutomationBatch({
        message: {
          ...createMockAutomationBatch().message,
          ippool: 'my-sparkpost-pool',
        },
      });

      await service.sendBatch(batch, providerFor(batch), null);

      expect(sparkPostHandler.createAutomationBatchMail).toHaveBeenCalled();
      expect(sparkPostHandler.sendEmail).toHaveBeenCalled();
    });
  });

  describe('parseBatchToMailDataRequired - Categories', () => {
    it('should configure correct categories for campaign', () => {
      const batch = createMockBatch({
        campaign_id: 999,
        campaign_name: 'Special Campaign',
      });
      (mailUtils.getCategoriesCampaign as jest.Mock).mockReturnValueOnce(['cat1', 'cat2', 'campaign_999']);

      const result = service.parseBatchToMailDataRequired(batch, '<p>HTML</p>');

      expect(result.categories).toContain('campaign_999');
      expect(mailUtils.getCategoriesCampaign).toHaveBeenCalledWith(
        batch.message,
        999,
        false, // campaign_test_ab_mode
        batch.account,
        expect.stringContaining('Special Campaign'), // Campaign name used as-is with suffix
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate SendGrid timeout error', async () => {
      const mail: any = {
        personalizations: [{ to: [{ email: 'test@example.com' }] }],
        from: { email: 'sender@test.com' },
        subject: 'Test',
        content: [{ type: 'text/html', value: '<p>Test</p>' }],
      };
      const account = {
        id: 1,
        name: 'Test Account',
        accountConfigs: [],
      };

      const timeoutError = new Error('ETIMEDOUT');
      (timeoutError as any).code = 'ETIMEDOUT';
      sendgridSendMock.mockRejectedValueOnce(timeoutError);

      await expect(service.sendMail(mail, account, false)).rejects.toThrow();
    });

    it('should propagate invalid API key error', async () => {
      const mail: any = {
        personalizations: [{ to: [{ email: 'test@example.com' }] }],
        from: { email: 'sender@test.com' },
        subject: 'Test',
        content: [{ type: 'text/html', value: '<p>Test</p>' }],
      };
      const account = {
        id: 1,
        name: 'Test Account',
        accountConfigs: [],
      };

      const authError: any = {
        response: {
          body: { errors: [{ message: 'Invalid API key' }] },
        },
      };
      sendgridSendMock.mockRejectedValueOnce(authError);

      await expect(service.sendMail(mail, account, false)).rejects.toThrow();
    });

    it('should propagate malformed SendGrid response error', async () => {
      const mail: any = {
        personalizations: [{ to: [{ email: 'test@example.com' }] }],
        from: { email: 'sender@test.com' },
        subject: 'Test',
        content: [{ type: 'text/html', value: '<p>Test</p>' }],
      };
      const account = {
        id: 1,
        name: 'Test Account',
        accountConfigs: [],
      };

      sendgridSendMock.mockRejectedValueOnce({ message: 'Unknown error', code: 500 });

      await expect(service.sendMail(mail, account, false)).rejects.toThrow();
    });
  });

  describe('createMail', () => {
    let sendEmailMessage: any;

    beforeEach(() => {
      sendEmailMessage = {
        messageId: 'msg-123',
        contact: {
          id: 1,
          uuid: 'uuid-123',
          email: 'contact@test.com',
          firstName: 'John',
        },
        account: {
          id: 10,
          name: 'Test Account Name',
        },
        message: {
          id: 100,
          from: {
            firstName: 'Sender',
            email: 'sender@test.com',
          },
          subject: 'Test Subject',
          location: {
            bucketName: 'test-bucket',
            fileName: 'test.html',
          },
        },
        automationType: 'email',
      };

      (mailUtils.getCategories as jest.Mock).mockReturnValue(['type_email']);
      (mailUtils.getIppol as jest.Mock).mockReturnValue('pool-name');
      (formatterUtils.normalizeString as jest.Mock).mockReturnValue('testaccountname');
    });

    it('should build email format with all standard fields', async () => {
      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.from).toEqual({ name: 'Sender', email: 'sender@test.com' });
      expect(result.subject).toBe('Test Subject');
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({ type: 'text/plain', value: 'abc' });
      expect(result.content[1]).toEqual({ type: 'text/html', value: '<p>Test HTML</p>' });
      expect(result.categories).toEqual(['type_email']);
      expect(result.ipPoolName).toBe('pool-name');
      expect(result.trackingSettings).toEqual({
        openTracking: { enable: true, substitutionTag: 'sendgrid_open_tracking' },
      });
      expect(result.mailSettings).toEqual({
        sandboxMode: { enable: false },
        bypassUnsubscribeManagement: { enable: true },
      });
      expect(result.customArgs).toMatchObject({
        contactId: '1',
        uuid: 'uuid-123',
        accountId: '10',
        sent_at: expect.any(String),
      });
    });

    it('should include replyTo when message.replyTo is present', async () => {
      sendEmailMessage.message.replyTo = 'reply@test.com';

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.replyTo).toEqual({
        email: 'reply@test.com',
        name: 'Sender',
      });
    });

    it('should not include replyTo when message.replyTo is absent', async () => {
      delete sendEmailMessage.message.replyTo;

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.replyTo).toBeUndefined();
    });

    it('should handle account 6 with personalizations', async () => {
      sendEmailMessage.account.id = 6;
      (mailUtils.mapVariables as jest.Mock).mockReturnValue({ var1: 'value1' });

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.personalizations).toBeDefined();
      expect(result.personalizations[0]).toMatchObject({
        to: [{ email: 'contact@test.com', name: 'John' }],
        substitutions: { var1: 'value1' },
        customArgs: {
          contactId: '1',
          uuid: 'uuid-123',
          sent_at: expect.any(String),
        },
      });
      expect(result.to).toBeUndefined();
      expect(mailUtils.mapVariables).toHaveBeenCalledWith(sendEmailMessage.contact, sendEmailMessage.account, sendEmailMessage.message, {}, true);
    });

    it('should handle non-account-6 with to field and headers', async () => {
      sendEmailMessage.account.id = 50;
      sendEmailMessage.automationType = 'transactional';

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.to).toEqual({
        name: 'John',
        email: 'contact@test.com',
      });
      expect((result as any).headers).toEqual({
        'Feedback-ID': 'id100:testaccountname:transactional:etusbms',
        'X-Feedback-ID': 'id100:testaccountname:transactional:etusbms',
      });
      expect(result.personalizations).toBeUndefined();
    });

    it('should include sendAt when provided', async () => {
      const sendAtTimestamp = Date.now() + 10000;
      sendEmailMessage.sendAt = sendAtTimestamp;

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.sendAt).toBe(sendAtTimestamp);
    });

    it('should not include sendAt when not provided', async () => {
      delete sendEmailMessage.sendAt;

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.sendAt).toBeUndefined();
    });

    it('should enable SANDBOX_MODE when environment variable is true', async () => {
      process.env.SANDBOX_MODE = 'true';

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.mailSettings.sandboxMode.enable).toBe(true);
      delete process.env.SANDBOX_MODE;
    });

    it('should include akross customArgs when AKROSSCLICKID exists', async () => {
      sendEmailMessage.contact.customFields = {
        AKROSSCLICKID: 'akross-123',
        ISNEW: true,
      };

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.customArgs.akrossClickId).toBe('akross-123');
      expect(result.customArgs.isNewContact).toBe('true');
    });

    it('should not include akross customArgs when AKROSSCLICKID is missing', async () => {
      sendEmailMessage.contact.customFields = {};

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.customArgs.akrossClickId).toBeUndefined();
      expect(result.customArgs.isNewContact).toBeUndefined();
    });

    it('should handle contact without firstName', async () => {
      delete sendEmailMessage.contact.firstName;

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect((result.to as any).name).toBe('');
    });

    it('should normalize automationType from "email" to "automation"', async () => {
      sendEmailMessage.automationType = 'email';
      sendEmailMessage.account.id = 99;

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect((result as any).headers['Feedback-ID']).toContain(':automation:');
    });

    it('should keep automationType as-is when not "email"', async () => {
      sendEmailMessage.automationType = 'retargeting';
      sendEmailMessage.account.id = 99;

      const result = await service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect((result as any).headers['Feedback-ID']).toContain(':retargeting:');
    });

    it.each([519992, 519959, 519958])('should generate text version for TEXT_VERSION_TEST_MESSAGE_ID %i and getHtmlContentIndex returns 1', (messageId) => {
      sendEmailMessage.message.id = messageId;
      sendEmailMessage.account.id = 99;

      const result = service['createMail'](sendEmailMessage, '<p>Test HTML</p>');

      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text/plain');
      expect(result.content[1].type).toBe('text/html');
    });
  });
});
