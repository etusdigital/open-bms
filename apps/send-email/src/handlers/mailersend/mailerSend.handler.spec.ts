import { Test } from '@nestjs/testing';
import { MailerSendHandler } from './mailerSend.handler';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';

const mockSend = jest.fn().mockResolvedValue({ statusCode: 202 });
const mockSendBulk = jest.fn().mockResolvedValue({ statusCode: 202 });

jest.mock('mailersend', () => {
  const Sender = jest.fn().mockImplementation((email: string, name?: string) => ({ email, name }));
  const Recipient = jest.fn().mockImplementation((email: string, name?: string) => ({ email, name }));
  class EmailParams {
    private _from: any;
    private _to: any;
    private _subject = '';
    private _html = '';
    private _tags: string[] = [];
    private _personalization: any = [];
    private _replyTo: any;
    setFrom(s: any) {
      this._from = s;
      return this;
    }
    setTo(r: any) {
      this._to = r;
      return this;
    }
    setSubject(s: string) {
      this._subject = s;
      return this;
    }
    setHtml(h: string) {
      this._html = h;
      return this;
    }
    setTags(t: string[]) {
      this._tags = t;
      return this;
    }
    setPersonalization(p: any) {
      this._personalization = p;
      return this;
    }
    setReplyTo(s: any) {
      this._replyTo = s;
      return this;
    }
    get tags() {
      return this._tags;
    }
    get to() {
      return this._to;
    }
    get subject() {
      return this._subject;
    }
    get from() {
      return this._from;
    }
  }
  class MailerSend {
    email = { send: mockSend, sendBulk: mockSendBulk };
    constructor(_: any) {}
  }
  return { MailerSend, EmailParams, Sender, Recipient };
});

describe('MailerSendHandler', () => {
  let handler: MailerSendHandler;

  const mockFormatter: any = {
    normalizeString: jest.fn((s: string) => s),
    slugify: jest.fn((s: string) => s),
  };
  const mockMailUtils: any = {
    getCategories: jest.fn(() => ['source_msgops', 'type_campaign', 'message_100', 'account_1', 'utmcampaign_test']),
    getCategoriesCampaign: jest.fn(() => ['type_campaign', 'message_100', 'account_1']),
    getIppol: jest.fn(() => 'pool'),
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
      providers: [MailerSendHandler, { provide: FormatterUtils, useValue: mockFormatter }, { provide: MailUtils, useValue: mockMailUtils }],
    }).compile();
    handler = module.get(MailerSendHandler);
  });

  describe('getMetadata', () => {
    it('returns mailersend metadata with hasFreeTier and hasWebhook true', () => {
      const meta = handler.getMetadata();
      expect(meta.name).toBe('mailersend');
      expect(meta.hasFreeTier).toBe(true);
      expect(meta.hasWebhook).toBe(true);
      expect(meta.notes).toContain('3000');
    });
  });

  describe('createMail', () => {
    it('builds EmailParams with from/to/subject/tags from getCategories', () => {
      const sendEmailMessage: any = {
        message: { id: 100, subject: 'Hello', from: { email: 'sender@x.com', firstName: 'Sender' } },
        contact: { id: 7, email: 'rcpt@x.com', firstName: 'Rcpt' },
        account: { id: 1, accountConfigs: [] },
      };
      const result = handler.createMail(sendEmailMessage, '<p>html</p>');
      expect((result as any).from).toEqual({ email: 'sender@x.com', name: 'Sender' });
      expect((result as any).subject).toBe('Hello');
      expect((result as any).tags).toEqual(expect.arrayContaining(['contactId_7']));
    });

    it('caps tags at 5 (MailerSend limit)', () => {
      mockMailUtils.getCategories.mockReturnValueOnce(['source_msgops', 'pool_a', 'type_campaign', 'message_1', 'account_1', 'utmcampaign_test', 'extra_dropped']);
      const sendEmailMessage: any = {
        message: { id: 100, subject: 'Hi', from: { email: 's@x.com', firstName: 'S' } },
        contact: { id: 1, email: 'r@x.com' },
        account: { id: 1 },
      };
      const result = handler.createMail(sendEmailMessage, '<p>x</p>');
      expect((result as any).tags.length).toBeLessThanOrEqual(5);
    });
  });

  describe('createCampaignBatchMail', () => {
    it('returns one EmailParams per contact', () => {
      const batch: any = {
        message: { id: 1, fromMail: 's@x.com', fromName: 'S', subject: 'Hi' },
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
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe('sendEmail', () => {
    it('calls .send for single EmailParams', async () => {
      await handler.sendEmail({} as any, { id: 1, accountConfigs: [] } as any);
      expect(mockSend).toHaveBeenCalled();
      expect(mockSendBulk).not.toHaveBeenCalled();
    });

    it('calls .sendBulk for array of EmailParams', async () => {
      await handler.sendEmail([{} as any, {} as any], { id: 1, accountConfigs: [] } as any);
      expect(mockSendBulk).toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('resolves api key from accountConfigs.mailersend_key when present', async () => {
      mockMailUtils.getAccountConfig.mockReturnValueOnce('mlsn.account-key');
      await handler.sendEmail({} as any, { id: 1, accountConfigs: [{ key: 'mailersend_key', value: 'mlsn.account-key' }] } as any);
      expect(mockMailUtils.getAccountConfig).toHaveBeenCalledWith(expect.anything(), 'mailersend_key');
    });

    it('falls back to MAILERSEND_API_KEY env when accountConfigs absent', async () => {
      process.env.MAILERSEND_API_KEY = 'mlsn.env-key';
      mockMailUtils.getAccountConfig.mockReturnValueOnce(undefined);
      await handler.sendEmail({} as any, { id: 1, accountConfigs: [] } as any);
      expect(mockSend).toHaveBeenCalled();
      delete process.env.MAILERSEND_API_KEY;
    });
  });
});
