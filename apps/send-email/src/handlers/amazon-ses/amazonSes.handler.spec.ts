import { Test } from '@nestjs/testing';
import { AmazonSesHandler } from './amazonSes.handler';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';

const mockSend = jest.fn().mockResolvedValue({ MessageId: 'ses-1' });

jest.mock('@aws-sdk/client-sesv2', () => {
  return {
    SESv2Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    SendEmailCommand: jest.fn().mockImplementation((args) => ({ __cmd: 'SendEmail', args })),
    SendBulkEmailCommand: jest.fn().mockImplementation((args) => ({ __cmd: 'SendBulk', args })),
  };
});

describe('AmazonSesHandler', () => {
  let handler: AmazonSesHandler;

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
      providers: [AmazonSesHandler, { provide: FormatterUtils, useValue: mockFormatter }, { provide: MailUtils, useValue: mockMailUtils }],
    }).compile();
    handler = module.get(AmazonSesHandler);
  });

  describe('getMetadata', () => {
    it('marks SES as no free tier perpetuum, with webhook capability', () => {
      const meta = handler.getMetadata();
      expect(meta.name).toBe('ses');
      expect(meta.hasFreeTier).toBe(false);
      expect(meta.hasWebhook).toBe(true);
      expect(meta.notes).toMatch(/EC2|free tier/i);
    });
  });

  describe('createMail', () => {
    it('builds Simple content with EmailTags from categories', () => {
      const sendEmailMessage: any = {
        message: { id: 100, subject: 'Hi', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 7, email: 'r@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>x</p>') as any;
      expect(result.Destination.ToAddresses).toEqual(['r@x.com']);
      expect(result.Content.Simple.Subject.Data).toBe('Hi');
      expect(result.EmailTags).toEqual(
        expect.arrayContaining([
          { Name: 'account', Value: '1' },
          { Name: 'message', Value: '100' },
          { Name: 'contactId', Value: '7' },
        ]),
      );
    });

    it('sanitizes tag values to SES-allowed charset', () => {
      mockMailUtils.getCategories.mockReturnValueOnce(['utmcampaign_my campaign!']);
      const sendEmailMessage: any = {
        message: { id: 1, subject: 'x', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 1, email: 'r@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>x</p>') as any;
      const utm = result.EmailTags.find((t: any) => t.Name === 'utmcampaign');
      expect(utm.Value).not.toMatch(/[ !]/);
    });
  });

  describe('createCampaignBatchMail', () => {
    it('returns BulkEmailEntries one per contact', () => {
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
      expect(result.BulkEmailEntries).toHaveLength(2);
      expect(result.DefaultEmailTags).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('uses SendEmailCommand for single payload', async () => {
      await handler.sendEmail(
        { Destination: { ToAddresses: ['x@x.com'] } } as any,
        {
          id: 1,
          accountConfigs: [],
        } as any,
      );
      expect(mockSend).toHaveBeenCalled();
      // The command instance carries the discriminator.
      expect(mockSend.mock.calls[0][0].__cmd).toBe('SendEmail');
    });

    it('uses SendBulkEmailCommand for bulk payload', async () => {
      await handler.sendEmail({ BulkEmailEntries: [{ Destination: { ToAddresses: ['a@x.com'] } }] } as any, { id: 1, accountConfigs: [] } as any);
      expect(mockSend.mock.calls[0][0].__cmd).toBe('SendBulk');
    });

    it('chunks bulk sends at 50 entries per call (SES limit)', async () => {
      const entries = Array.from({ length: 120 }, (_, i) => ({ Destination: { ToAddresses: [`u${i}@x.com`] } }));
      await handler.sendEmail({ BulkEmailEntries: entries } as any, { id: 1, accountConfigs: [] } as any);
      // Math.ceil(120/50) = 3 calls
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('resolves credentials from accountConfigs first, then env fallback', async () => {
      mockMailUtils.getAccountConfig.mockReturnValueOnce('AKIA-account').mockReturnValueOnce('secret-account');
      await handler.sendEmail(
        {} as any,
        {
          id: 1,
          accountConfigs: [
            { key: 'ses_access_key_id', value: 'AKIA-account' },
            { key: 'ses_secret_access_key', value: 'secret-account' },
          ],
        } as any,
      );
      expect(mockMailUtils.getAccountConfig).toHaveBeenCalledWith(expect.anything(), 'ses_access_key_id');
      expect(mockMailUtils.getAccountConfig).toHaveBeenCalledWith(expect.anything(), 'ses_secret_access_key');
    });
  });
});
