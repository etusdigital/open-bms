import { Test } from '@nestjs/testing';
import { MandrillHandler } from './mandrill.handler';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';

const mockSend = jest.fn().mockResolvedValue([{ status: 'sent', email: 'r@x.com', _id: 'mdl-1' }]);

jest.mock('@mailchimp/mailchimp_transactional', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { send: mockSend },
  })),
}));

describe('MandrillHandler', () => {
  let handler: MandrillHandler;

  const mockFormatter: any = { normalizeString: jest.fn((s: string) => s) };
  const mockMailUtils: any = {
    getCategories: jest.fn(() => ['source_msgops', 'message_100', 'account_1']),
    getCategoriesCampaign: jest.fn(() => ['source_msgops', 'message_1', 'account_1']),
    parseUnsubscriber: jest.fn((html: string) => html),
    parseHandlebarsVariables: jest.fn((html: string) => html),
    createPreviewText: jest.fn((html: string) => html),
    mapVariables: jest.fn(() => ({})),
    createEmailPixel: jest.fn(() => ({ template: '<p>html</p>', replaceLinks: {} })),
    getAccountConfig: jest.fn(() => undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [MandrillHandler, { provide: FormatterUtils, useValue: mockFormatter }, { provide: MailUtils, useValue: mockMailUtils }],
    }).compile();
    handler = module.get(MandrillHandler);
  });

  describe('getMetadata', () => {
    it('marks Mandrill as paid (no free tier) with webhook capability', () => {
      const meta = handler.getMetadata();
      expect(meta.name).toBe('mandrill');
      expect(meta.hasFreeTier).toBe(false);
      expect(meta.hasWebhook).toBe(true);
      expect(meta.notes).toMatch(/free tier|paid|\$/i);
    });
  });

  describe('createMail', () => {
    it('builds Mandrill message with metadata flat-map from categories', () => {
      const sendEmailMessage: any = {
        message: { id: 100, subject: 'Hello', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 7, email: 'r@x.com', firstName: 'Rcpt' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>html</p>') as any;
      expect(result.message.to).toEqual([{ email: 'r@x.com', name: 'Rcpt', type: 'to' }]);
      expect(result.message.metadata).toEqual(
        expect.objectContaining({
          contactId: '7',
          account: '1',
          message: '100',
        }),
      );
    });

    it('caps metadata to 10 entries (Mandrill per-message limit)', () => {
      mockMailUtils.getCategories.mockReturnValueOnce(Array.from({ length: 15 }, (_, i) => `key${i}_value${i}`));
      const sendEmailMessage: any = {
        message: { id: 1, subject: 'x', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 1, email: 'r@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>x</p>') as any;
      expect(Object.keys(result.message.metadata).length).toBeLessThanOrEqual(10);
    });
  });

  describe('createCampaignBatchMail', () => {
    it('returns single message with all contacts in to[]', () => {
      const batch: any = {
        message: { id: 1, fromMail: 's@x.com', fromName: 'S', subject: 'Hi', replyTo: null },
        contacts: [
          { id: 1, email: 'a@x.com' },
          { id: 2, email: 'b@x.com' },
        ],
        account: { id: 1 },
        campaign_id: 99,
        campaign_test_ab_mode: false,
        campaign_name: 'cmp',
        campaign: { id: 99, scheduleTo: 0, spreadSending: 0 },
        page: 1,
      };
      const result = handler.createCampaignBatchMail(batch, '<p>x</p>') as any;
      expect(result.message.to).toHaveLength(2);
    });
  });

  describe('sendEmail', () => {
    it('calls messages.send with the prebuilt envelope', async () => {
      await handler.sendEmail({ message: { from_email: 's@x.com', subject: 'Hi', html: '<p/>', to: [] } } as any, { id: 1, accountConfigs: [] } as any);
      expect(mockSend).toHaveBeenCalled();
    });

    it('resolves api key from accountConfigs.mandrill_key first', async () => {
      mockMailUtils.getAccountConfig.mockReturnValueOnce('md-account-key');
      await handler.sendEmail(
        { message: { from_email: 's@x.com', subject: 'Hi', html: '<p/>', to: [] } } as any,
        { id: 1, accountConfigs: [{ key: 'mandrill_key', value: 'md-account-key' }] } as any,
      );
      expect(mockMailUtils.getAccountConfig).toHaveBeenCalledWith(expect.anything(), 'mandrill_key');
    });

    it('falls back to MANDRILL_API_KEY env when accountConfigs absent', async () => {
      process.env.MANDRILL_API_KEY = 'md-env-key';
      mockMailUtils.getAccountConfig.mockReturnValueOnce(undefined);
      await handler.sendEmail({ message: { from_email: 's@x.com', subject: 'Hi', html: '<p/>', to: [] } } as any, { id: 1, accountConfigs: [] } as any);
      expect(mockSend).toHaveBeenCalled();
      delete process.env.MANDRILL_API_KEY;
    });
  });
});
