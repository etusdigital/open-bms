import { Test } from '@nestjs/testing';
import { ResendHandler } from './resend.handler';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';

const mockEmailsSend = jest.fn().mockResolvedValue({ data: { id: 'res-1' } });
const mockBatchSend = jest.fn().mockResolvedValue({ data: { ids: ['res-1'] } });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
    batch: { send: mockBatchSend },
  })),
}));

describe('ResendHandler', () => {
  let handler: ResendHandler;

  const mockFormatter: any = { normalizeString: jest.fn((s: string) => s) };
  const mockMailUtils: any = {
    getCategories: jest.fn(() => ['source_msgops', 'message_100', 'account_1', 'utmcampaign_test']),
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
      providers: [ResendHandler, { provide: FormatterUtils, useValue: mockFormatter }, { provide: MailUtils, useValue: mockMailUtils }],
    }).compile();
    handler = module.get(ResendHandler);
  });

  describe('getMetadata', () => {
    it('returns resend metadata with hasFreeTier and hasWebhook true', () => {
      const meta = handler.getMetadata();
      expect(meta.name).toBe('resend');
      expect(meta.hasFreeTier).toBe(true);
      expect(meta.hasWebhook).toBe(true);
    });
  });

  describe('createMail', () => {
    it('builds payload with from "Name <email>" format and X-Entity-Ref-ID header', () => {
      const sendEmailMessage: any = {
        message: { id: 100, subject: 'Hello', from: { email: 'sender@x.com', firstName: 'Sender' } },
        contact: { id: 7, email: 'rcpt@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>html</p>');
      expect((result as any).from).toBe('Sender <sender@x.com>');
      expect((result as any).to).toBe('rcpt@x.com');
      expect((result as any).headers['X-Entity-Ref-ID']).toBe('7');
    });

    it('converts SendGrid-style underscored categories into {name,value} tags', () => {
      const sendEmailMessage: any = {
        message: { id: 100, subject: 'Hello', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 1, email: 'r@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>x</p>') as any;
      expect(result.tags).toEqual(
        expect.arrayContaining([
          { name: 'message', value: '100' },
          { name: 'account', value: '1' },
          { name: 'contactId', value: '1' },
        ]),
      );
    });

    it('sanitizes tag values to alphanumeric/_/- only', () => {
      mockMailUtils.getCategories.mockReturnValueOnce(['utmcampaign_my campaign with spaces!']);
      const sendEmailMessage: any = {
        message: { id: 1, subject: 'x', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 1, email: 'r@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>x</p>') as any;
      const utm = result.tags.find((t: any) => t.name === 'utmcampaign');
      expect(utm.value).not.toMatch(/[ !]/);
    });
  });

  describe('createCampaignBatchMail', () => {
    it('returns one payload per contact', () => {
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
      const result = handler.createCampaignBatchMail(batch, '<p>html</p>');
      expect(result).toHaveLength(2);
      expect((result[0] as any).headers['X-Entity-Ref-ID']).toBe('1');
    });
  });

  describe('sendEmail', () => {
    it('calls emails.send for single payload', async () => {
      await handler.sendEmail({} as any, { id: 1, accountConfigs: [] } as any);
      expect(mockEmailsSend).toHaveBeenCalled();
      expect(mockBatchSend).not.toHaveBeenCalled();
    });

    it('calls batch.send for array payload', async () => {
      await handler.sendEmail([{} as any, {} as any], { id: 1, accountConfigs: [] } as any);
      expect(mockBatchSend).toHaveBeenCalled();
    });

    it('chunks batch sends at 100 per call', async () => {
      const payloads = Array.from({ length: 250 }, () => ({}));
      await handler.sendEmail(payloads as any, { id: 1, accountConfigs: [] } as any);
      // Math.ceil(250/100) = 3 calls
      expect(mockBatchSend).toHaveBeenCalledTimes(3);
    });

    it('resolves api key from accountConfigs.resend_key when present', async () => {
      mockMailUtils.getAccountConfig.mockReturnValueOnce('re_account-key');
      await handler.sendEmail({} as any, { id: 1, accountConfigs: [{ key: 'resend_key', value: 're_account-key' }] } as any);
      expect(mockMailUtils.getAccountConfig).toHaveBeenCalledWith(expect.anything(), 'resend_key');
    });
  });
});
