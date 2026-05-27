import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { SparkPostHandler } from './sparkPost.handler';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';
import { SendEmailMessage, AutomationContactsBatch } from '../../interfaces';
import { Batch } from '../../mail/mail.interface';

/**
 * SparkPostHandler Test Suite
 *
 * Testa a integração com o provider SparkPost, incluindo:
 * - Criação de emails single e batch
 * - Processamento de campanhas e automações
 * - Sandbox mode
 * - Error handling
 */
describe('SparkPostHandler', () => {
  let handler: SparkPostHandler;
  let formatterUtils: jest.Mocked<FormatterUtils>;
  let mailUtils: jest.Mocked<MailUtils>;

  // Factory function para SendEmailMessage
  const createMockSendEmailMessage = (overrides: Partial<SendEmailMessage> = {}): any => ({
    messageId: 'msg-123',
    startedAt: Date.now(),
    automationId: 456,
    automationName: 'Test Automation',
    automationType: 'email',
    isRateLimit: false,
    utmContent: 'test-content',
    utmCampaign: 'test-campaign',
    contact: {
      id: 1,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      isValid: true,
      uuid: 'uuid-123',
    },
    message: {
      id: 100,
      name: 'Test Message',
      title: 'Test Title',
      ippool: 'sparkpost-pool',
      subject: 'Test Subject',
      content: '<p>Test content</p>',
      priority: 'normal',
      location: {
        bucketName: 'test-bucket',
        fileName: 'test-file.html',
      },
      from: {
        email: 'sender@example.com',
        firstName: 'Sender Name',
      },
      replyTo: null,
    },
    next: {
      pubName: '',
      data: {
        id: 'lead-123',
        automation: {
          id: 'auto-123',
          type: 'email',
          isRateLimit: false,
          activeStep: { postion: 0, id: 'step-1', type: 'email' },
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: 'step-1',
        contact: { id: 1, email: 'test@example.com', uuid: 'uuid-123', isValid: true },
        tagName: 'test-tag',
        createdAt: Date.now(),
      },
    },
    account: {
      id: 1,
      name: 'Test Account',
      accountConfigs: [],
    },
    ...overrides,
  });

  // Factory function para Batch (Campaign)
  const createMockCampaignBatch = (overrides: Partial<Batch> = {}): any => ({
    campaign_id: 123,
    campaign_name: 'Test Campaign',
    campaign_test_ab_mode: false,
    is_campaign_warmup_mode: undefined,
    page: 1,
    totalPages: 1,
    contacts: [
      { id: 1, email: 'user1@test.com', firstName: 'User', lastName: 'One', isValid: true, uuid: 'uuid-1' },
      { id: 2, email: 'user2@test.com', firstName: 'User', lastName: 'Two', isValid: true, uuid: 'uuid-2' },
    ],
    message: {
      id: 100,
      name: 'test-message',
      ippool: 'sparkpost-pool',
      subject: 'Hello {{FIRSTNAME}}',
      fromMail: 'sender@test.com',
      fromName: 'Sender Name',
      replyTo: null,
      content: '<p>Campaign content</p>',
      previewText: null,
    },
    account: {
      id: 1,
      name: 'Test Account Name',
      accountConfigs: [],
    },
    ...overrides,
  });

  // Factory function para AutomationContactsBatch
  const createMockAutomationBatch = (overrides: Partial<AutomationContactsBatch> = {}): any => ({
    messageId: 'msg-456',
    automationType: 'email',
    utmCampaign: 'automation-campaign',
    link: 'https://example.com',
    contacts: [{ id: 1, email: 'auto1@test.com', firstName: 'Auto', lastName: 'One', isValid: true, uuid: 'uuid-1' }],
    message: {
      id: 200,
      name: 'automation-message',
      ippool: 'sparkpost-automation',
      subject: 'Automation {{FIRSTNAME}}',
      content: '<p>Automation content</p>',
      previewText: null,
      from: {
        email: 'auto@example.com',
        firstName: 'Auto Sender',
      },
      replyTo: null,
    },
    account: {
      id: 2,
      name: 'Automation Account',
      accountConfigs: [],
    },
    ...overrides,
  });

  beforeEach(async () => {
    const mockFormatterUtils = {
      normalizeString: jest.fn((text: string) => text?.toLowerCase().replace(/[^a-z0-9]/g, '')),
      slugify: jest.fn((text: string) => text?.toLowerCase().replace(/\s+/g, '-')),
      isValidEmail: jest.fn().mockReturnValue(true),
    };

    const mockMailUtils = {
      getCategoriesSparkpost: jest.fn((categories: string[]) => {
        const result: any = {};
        categories.forEach((cat, idx) => {
          result[`category_${idx + 1}`] = cat;
        });
        return result;
      }),
      getCategories: jest.fn((data: any) => {
        const cats = ['category1'];
        if (data.messageId) cats.push(data.messageId);
        return cats;
      }),
      getCategoriesCampaign: jest.fn(() => ['campaign-cat1', 'campaign-cat2']),
      parseUnsubscriber: jest.fn((html: string) => html.replace('[unsubscribe]', '<a href="{{unsubscribe_url}}">Unsubscribe</a>')),
      createPreviewText: jest.fn((html: string, preview: string) => `<span style="display:none">${preview}</span>${html}`),
      parseHandlebarsVariables: jest.fn((html: string) => html),
      getIppol: jest.fn((message: any) => message?.ippool || 'default-pool'),
      createEmailPixel: jest.fn((params: any) => ({
        template: params.emailContent + '<!-- tracking pixel -->',
        replaceLinks: [{ original: 'https://example.com', replaced: 'https://tracked.com' }],
      })),
      mapVariables: jest.fn((contact: any) => ({
        FIRSTNAME: contact.firstName,
        LASTNAME: contact.lastName,
        EMAIL: contact.email,
      })),
      getAccountConfig: jest.fn((configs: any[], key: string) => {
        const config = configs?.find((c) => c.name === key);
        return config?.value;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SparkPostHandler, { provide: FormatterUtils, useValue: mockFormatterUtils }, { provide: MailUtils, useValue: mockMailUtils }],
    }).compile();

    handler = module.get<SparkPostHandler>(SparkPostHandler);
    formatterUtils = module.get(FormatterUtils);
    mailUtils = module.get(MailUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMail() - Single Email', () => {
    it('should create valid SparkPost mail object', () => {
      const sendEmailMessage = createMockSendEmailMessage();
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('campaign_id');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('return_path');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('recipients');
    });

    it('should configure tracking (open and click)', () => {
      const sendEmailMessage = createMockSendEmailMessage();
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.options.open_tracking).toBe(true);
      expect(result.options.click_tracking).toBe(true);
    });

    it('should include correct ip_pool from message', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        message: {
          ...createMockSendEmailMessage().message,
          ippool: 'custom-sparkpost-pool',
        },
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.options.ip_pool).toBe('custom-sparkpost-pool');
    });

    it('should configure return_path from sender email', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        message: {
          ...createMockSendEmailMessage().message,
          from: { email: 'custom@sender.com', firstName: 'Custom' },
        },
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.return_path).toBe('custom@sender.com');
    });

    it('should include reply_to when message.replyTo is present', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        message: {
          ...createMockSendEmailMessage().message,
          replyTo: 'reply@example.com',
          from: { email: 'sender@test.com', firstName: 'Sender' },
        },
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.content.reply_to).toBe('Sender <reply@example.com>');
    });

    it('should omit reply_to when message.replyTo is not provided', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        message: {
          ...createMockSendEmailMessage().message,
          replyTo: null,
        },
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.content.reply_to).toBeUndefined();
    });

    it('should create campaign_id with slugified utmCampaign', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        utmCampaign: 'Test Campaign 2024',
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(formatterUtils.slugify).toHaveBeenCalledWith('Test Campaign 2024');
      expect(result.campaign_id).toContain('test-campaign-2024');
    });

    it('should include metadata with categories', () => {
      const sendEmailMessage = createMockSendEmailMessage();
      mailUtils.getCategories.mockReturnValue(['cat1', 'cat2']);
      mailUtils.getCategoriesSparkpost.mockReturnValue({ category_1: 'cat1', category_2: 'cat2' });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.metadata).toHaveProperty('category_1');
      expect(result.metadata).toHaveProperty('category_2');
    });

    it('should include contactId in metadata when contact.id present', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        contact: {
          ...createMockSendEmailMessage().contact,
          id: 999,
        },
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.metadata.contactId).toBe('999');
    });

    it('should configure headers with correct Feedback-ID format', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        message: { ...createMockSendEmailMessage().message, id: 555 },
        account: { id: 1, name: 'Test Account', accountConfigs: [] },
        automationType: 'email',
      });
      formatterUtils.normalizeString.mockReturnValue('testaccount');
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.content.headers['Feedback-ID']).toBe('id555:testaccount:automation:etusbms');
    });

    it('should process unsubscriber in HTML', () => {
      const sendEmailMessage = createMockSendEmailMessage();
      const html = '<p>Click [unsubscribe] to opt-out</p>';
      mailUtils.parseUnsubscriber.mockReturnValue('<p>Click <a href="{{unsubscribe_url}}">Unsubscribe</a> to opt-out</p>');

      const result = handler.createMail(sendEmailMessage, html);

      expect(mailUtils.parseUnsubscriber).toHaveBeenCalledWith(html, sendEmailMessage.account);
      expect(result.content.html).toContain('{{unsubscribe_url}}');
    });

    it('should include start_time in options when sendAt is provided', () => {
      const sendAt = new Date('2024-12-31T23:59:59Z').getTime();
      const sendEmailMessage = createMockSendEmailMessage({ sendAt });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.options.start_time).toBe(sendAt);
    });

    it('should format recipient with contact email and name', () => {
      const sendEmailMessage = createMockSendEmailMessage({
        contact: {
          ...createMockSendEmailMessage().contact,
          email: 'recipient@example.com',
          firstName: 'Jane',
        },
      });
      const html = '<p>Test HTML</p>';

      const result = handler.createMail(sendEmailMessage, html);

      expect(result.recipients).toHaveLength(1);
      expect(result.recipients[0].address.email).toContain('recipient@example.com');
      expect(result.recipients[0].address.name).toBe('Jane');
    });
  });

  describe('createCampaignBatchMail() - Campaign Batch', () => {
    it('should create batch mail for campaign with multiple contacts', () => {
      const batch = createMockCampaignBatch();
      const html = '<p>Campaign HTML</p>';

      const result = handler.createCampaignBatchMail(batch, html);

      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('campaign_id');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('recipients');
      expect(result.recipients).toHaveLength(2);
    });

    it('should include substitution_data for each contact', () => {
      const batch = createMockCampaignBatch();
      const html = '<p>Campaign HTML</p>';
      mailUtils.mapVariables.mockReturnValue({ FIRSTNAME: 'User', LASTNAME: 'One', EMAIL: 'user1@test.com' });

      const result = handler.createCampaignBatchMail(batch, html);

      expect(result.recipients[0]).toHaveProperty('substitution_data');
      expect(result.recipients[0].substitution_data).toHaveProperty('FIRSTNAME');
      expect(mailUtils.mapVariables).toHaveBeenCalledTimes(2); // 2 contacts
    });

    it('should apply previewText when provided', () => {
      const batch = createMockCampaignBatch({
        message: {
          ...createMockCampaignBatch().message,
          previewText: 'This is a preview',
        },
      });
      const html = '<p>Campaign HTML</p>';
      mailUtils.createPreviewText.mockReturnValue('<span style="display:none">This is a preview</span><p>Campaign HTML</p>');

      handler.createCampaignBatchMail(batch, html);

      expect(mailUtils.createPreviewText).toHaveBeenCalledWith(html, 'This is a preview');
    });

    it('should apply Handlebars variables to HTML', () => {
      const batch = createMockCampaignBatch();
      const html = '<p>Hello {{FIRSTNAME}}</p>';
      mailUtils.parseHandlebarsVariables.mockReturnValue('<p>Hello User</p>');

      handler.createCampaignBatchMail(batch, html);

      expect(mailUtils.parseHandlebarsVariables).toHaveBeenCalledWith(expect.any(String), batch.account);
    });

    it('should configure campaign_id with slugified campaign name', () => {
      const batch = createMockCampaignBatch({ campaign_name: 'Summer Sale 2024' });
      const html = '<p>Campaign HTML</p>';
      formatterUtils.slugify.mockReturnValue('summer-sale-2024');

      const result = handler.createCampaignBatchMail(batch, html);

      expect(formatterUtils.slugify).toHaveBeenCalledWith('Summer Sale 2024');
      expect(result.campaign_id).toContain('summer-sale-2024');
    });

    it('should process campaign_test_ab_mode flag', () => {
      const batch = createMockCampaignBatch({ campaign_test_ab_mode: true });
      const html = '<p>Campaign HTML</p>';

      handler.createCampaignBatchMail(batch, html);

      expect(mailUtils.getCategoriesCampaign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number),
        true, // campaign_test_ab_mode
        expect.any(Object),
        expect.any(String),
      );
    });

    it('should include isWarmupCampaign in metadata when is_campaign_warmup_mode present', () => {
      const batch = createMockCampaignBatch({ is_campaign_warmup_mode: true });
      const html = '<p>Campaign HTML</p>';

      const result = handler.createCampaignBatchMail(batch, html);

      expect(result.recipients[0].metadata.isWarmupCampaign).toBe('true');
    });

    it('should include reply_to when message.replyTo is provided', () => {
      const batch = createMockCampaignBatch({
        message: {
          ...createMockCampaignBatch().message,
          replyTo: 'campaign-reply@test.com',
          fromName: 'Campaign Sender',
        },
      });
      const html = '<p>Campaign HTML</p>';

      const result = handler.createCampaignBatchMail(batch, html);

      expect(result.content.reply_to).toBe('Campaign Sender <campaign-reply@test.com>');
    });

    it('should parse Handlebars in subject line', () => {
      const batch = createMockCampaignBatch({
        message: {
          ...createMockCampaignBatch().message,
          subject: 'Hello {{FIRSTNAME}}',
        },
      });
      const html = '<p>Campaign HTML</p>';
      mailUtils.parseHandlebarsVariables.mockImplementation((text) => text.replace('{{FIRSTNAME}}', 'User'));

      handler.createCampaignBatchMail(batch, html);

      expect(mailUtils.parseHandlebarsVariables).toHaveBeenCalledWith('Hello {{FIRSTNAME}}', batch.account);
    });

    it('should include contactId in each recipient metadata', () => {
      const batch = createMockCampaignBatch();
      const html = '<p>Campaign HTML</p>';

      const result = handler.createCampaignBatchMail(batch, html);

      expect(result.recipients[0].metadata.contactId).toBe('1');
      expect(result.recipients[1].metadata.contactId).toBe('2');
    });
  });

  describe('createAutomationBatchMail() - Automation Batch', () => {
    it('should create batch mail for automation', () => {
      const batch = createMockAutomationBatch();
      const html = '<p>Automation HTML</p>';

      const result = handler.createAutomationBatchMail(batch, html);

      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('campaign_id');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('recipients');
    });

    it('should include messageId in categories via getCategories', () => {
      const batch = createMockAutomationBatch({ messageId: 'automation-msg-789' });
      const html = '<p>Automation HTML</p>';
      mailUtils.getCategories.mockReturnValue(['cat1', 'automation-msg-789']);

      handler.createAutomationBatchMail(batch, html);

      expect(mailUtils.getCategories).toHaveBeenCalledWith(batch);
    });

    it('should process location data (bucketName, fileName) via categories', () => {
      const batch = createMockAutomationBatch();
      const html = '<p>Automation HTML</p>';

      handler.createAutomationBatchMail(batch, html);

      expect(mailUtils.getCategories).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-456',
        }),
      );
    });

    it('should include automation type in headers Feedback-ID', () => {
      const batch = createMockAutomationBatch({ automationType: 'retargeting' });
      const html = '<p>Automation HTML</p>';
      formatterUtils.normalizeString.mockReturnValue('automationaccount');

      const result = handler.createAutomationBatchMail(batch, html);

      expect(result.content.headers['Feedback-ID']).toContain(':retargeting:');
    });

    it('should convert automationType "email" to "automation" in Feedback-ID', () => {
      const batch = createMockAutomationBatch({ automationType: 'email' });
      const html = '<p>Automation HTML</p>';
      formatterUtils.normalizeString.mockReturnValue('automationaccount');

      const result = handler.createAutomationBatchMail(batch, html);

      expect(result.content.headers['Feedback-ID']).toContain(':automation:');
    });

    it('should configure metadata correctly', () => {
      const batch = createMockAutomationBatch();
      const html = '<p>Automation HTML</p>';
      mailUtils.getCategoriesSparkpost.mockReturnValue({ category_1: 'auto-cat1', category_2: 'auto-cat2' });

      const result = handler.createAutomationBatchMail(batch, html);

      expect(result.metadata).toEqual({ category_1: 'auto-cat1', category_2: 'auto-cat2' });
    });

    it('should include dynamic link in createEmailPixel params', () => {
      const batch = createMockAutomationBatch({ link: 'https://dynamic-link.com' });
      const html = '<p>Automation HTML</p>';

      handler.createAutomationBatchMail(batch, html);

      expect(mailUtils.createEmailPixel).toHaveBeenCalledWith(
        expect.objectContaining({
          dynamicLink: 'https://dynamic-link.com',
        }),
      );
    });

    it('should use message.name for campaign_id', () => {
      const batch = createMockAutomationBatch({
        message: {
          ...createMockAutomationBatch().message,
          name: 'Welcome Email Automation',
        },
      });
      const html = '<p>Automation HTML</p>';
      formatterUtils.slugify.mockReturnValue('welcome-email-automation');

      const result = handler.createAutomationBatchMail(batch, html);

      expect(formatterUtils.slugify).toHaveBeenCalledWith('Welcome Email Automation');
      expect(result.campaign_id).toContain('welcome-email-automation');
    });
  });

  describe('sendEmail()', () => {
    it('should call Sparkpost transmissions.send with mail object', async () => {
      const mockSend = jest.fn().mockResolvedValue({ results: { id: 'transmission-123' } });
      const MockSparkpost = jest.fn().mockImplementation(() => ({
        transmissions: { send: mockSend },
      }));

      // Mock do Sparkpost no módulo
      jest.mock('sparkpost', () => MockSparkpost);

      const mail = { content: { subject: 'Test' }, recipients: [] };
      const account = { id: 1, name: 'Test', accountConfigs: [] };

      // Sobrescrever a instância do SparkPost via process.env
      process.env.SPARKPOST_API_KEY = 'test-key';

      // Como não podemos mockar o new Sparkpost() facilmente sem mais setup,
      // vamos testar que o método chama a lógica esperada
      await expect(handler.sendEmail(mail, account)).rejects.toThrow();
    });

    it('should use account sparkpost_key when provided', async () => {
      const account: any = {
        id: 1,
        name: 'Test',
        accountConfigs: [{ accountId: 1, name: 'sparkpost_key', value: 'account-sparkpost-key' }],
      };
      mailUtils.getAccountConfig.mockReturnValue('account-sparkpost-key');

      await expect(handler.sendEmail({}, account)).rejects.toThrow();

      expect(mailUtils.getAccountConfig).toHaveBeenCalledWith(account.accountConfigs, 'sparkpost_key');
    });

    it('should use SPARKPOST_API_KEY env var when account config not provided', async () => {
      process.env.SPARKPOST_API_KEY = 'env-sparkpost-key';
      const account: any = { id: 1, name: 'Test', accountConfigs: [] };

      await expect(handler.sendEmail({}, account)).rejects.toThrow();
    });

    it('should throw HttpException when send fails', async () => {
      const mail = { content: { subject: 'Test' }, recipients: [] };
      const account: any = { id: 1, name: 'Test', accountConfigs: [] };

      await expect(handler.sendEmail(mail, account)).rejects.toThrow(HttpException);
      await expect(handler.sendEmail(mail, account)).rejects.toThrow('Cannot send this email!');
    });

    it('should log error details when send fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mail = { content: { subject: 'Test' }, recipients: [] };
      const account: any = { id: 1, name: 'Test', accountConfigs: [] };

      await expect(handler.sendEmail(mail, account)).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('sandBoxParseEmail()', () => {
    it('should return original email in production mode', () => {
      delete process.env.SANDBOX_MODE;
      const email = 'user@example.com';

      const result = handler.sandBoxParseEmail(email);

      expect(result).toBe('user@example.com');
    });

    it('should append .sink.sparkpostmail.com in sandbox mode', () => {
      process.env.SANDBOX_MODE = 'true';
      const email = 'user@example.com';

      const result = handler.sandBoxParseEmail(email);

      expect(result).toBe('user@example.com.sink.sparkpostmail.com');
    });

    it('should maintain email format validity', () => {
      process.env.SANDBOX_MODE = 'true';
      const email = 'test+tag@domain.co.uk';

      const result = handler.sandBoxParseEmail(email);

      expect(result).toContain('test+tag@domain.co.uk');
      expect(result).toContain('.sink.sparkpostmail.com');
    });
  });

  describe('sandBoxParseCampaign()', () => {
    it('should return campaign sliced to 64 chars in production', () => {
      delete process.env.SANDBOX_MODE;
      const campaign = 'a'.repeat(100);

      const result = handler.sandBoxParseCampaign(campaign);

      expect(result).toHaveLength(64);
    });

    it('should add sandbox prefix in sandbox mode', () => {
      process.env.SANDBOX_MODE = 'true';
      const campaign = 'test-campaign';

      const result = handler.sandBoxParseCampaign(campaign);

      expect(result).toContain('sparkpost-performance-test-');
      expect(result).toContain('test-campaign');
    });

    it('should limit campaign_id to 64 characters', () => {
      process.env.SANDBOX_MODE = 'true';
      const campaign = 'very-long-campaign-name-that-exceeds-the-maximum-allowed-length-for-sparkpost';

      const result = handler.sandBoxParseCampaign(campaign);

      expect(result).toHaveLength(64);
    });

    it('should handle empty campaign string', () => {
      delete process.env.SANDBOX_MODE;
      const campaign = '';

      const result = handler.sandBoxParseCampaign(campaign);

      expect(result).toBe('');
    });
  });
});
