import { Test, TestingModule } from '@nestjs/testing';
import * as sendgrid from '@sendgrid/mail';
import { SendGridHandler } from './sendGrid.handler';
import { FormatterUtils } from '../../utils/formatter.utils';
import { HtmlToTextService } from '../../html-to-text/html-to-text.service';
import { MailUtils } from '../../mail/mail.utils';

describe('SendGridHandler', () => {
  let handler: SendGridHandler;
  let setDefaultRequestSpy: jest.Mock;
  let setApiKeySpy: jest.SpyInstance;
  let sendgridSendMock: jest.Mock;

  beforeEach(async () => {
    sendgridSendMock = jest.fn().mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }]);
    setDefaultRequestSpy = jest.fn();
    (sendgrid as unknown as { client: { setDefaultRequest: jest.Mock } }).client = {
      setDefaultRequest: setDefaultRequestSpy,
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendGridHandler,
        { provide: FormatterUtils, useValue: { normalizeString: jest.fn((s) => s) } },
        { provide: HtmlToTextService, useValue: { convert: jest.fn(() => 'plain') } },
        {
          provide: MailUtils,
          useValue: {
            getAccountConfig: jest.fn((configs, key) => configs?.find((c: any) => c.name === key)?.value),
            getIppol: jest.fn((m) => m?.ippool ?? ''),
          },
        },
      ],
    }).compile();

    handler = module.get<SendGridHandler>(SendGridHandler);

    jest.spyOn(sendgrid, 'send').mockImplementation(sendgridSendMock as any);
    setApiKeySpy = jest.spyOn(sendgrid, 'setApiKey').mockImplementation(() => undefined);

    process.env.SENDGRID_API_KEY = 'SG.DefaultEnvKey';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SENDGRID_API_BASE_URL;
  });

  describe('SENDGRID_API_BASE_URL override (EVO-1052)', () => {
    it('calls setApiKey BEFORE setDefaultRequest when env is set', async () => {
      process.env.SENDGRID_API_BASE_URL = 'http://sendgrid-mock:3010';
      const mail: any = { from: { email: 's@s.com' }, subject: 't', content: [], categories: [] };

      await handler.sendEmail(mail, { id: 1, name: 'X', accountConfigs: null } as any, false);

      const setApiKeyOrder = setApiKeySpy.mock.invocationCallOrder[0];
      const setDefaultRequestOrder = setDefaultRequestSpy.mock.invocationCallOrder[0];
      expect(setApiKeyOrder).toBeLessThan(setDefaultRequestOrder);
      expect(setDefaultRequestSpy).toHaveBeenCalledWith('baseUrl', 'http://sendgrid-mock:3010');
    });

    it('strips trailing slashes from SENDGRID_API_BASE_URL', async () => {
      process.env.SENDGRID_API_BASE_URL = 'http://sendgrid-mock:3010///';
      const mail: any = { from: { email: 's@s.com' }, subject: 't', content: [], categories: [] };

      await handler.sendEmail(mail, { id: 1, name: 'X', accountConfigs: null } as any, false);

      expect(setDefaultRequestSpy).toHaveBeenCalledWith('baseUrl', 'http://sendgrid-mock:3010');
    });

    it('does NOT call setDefaultRequest when SENDGRID_API_BASE_URL is unset (production path preserved)', async () => {
      delete process.env.SENDGRID_API_BASE_URL;
      const mail: any = { from: { email: 's@s.com' }, subject: 't', content: [], categories: [] };

      await handler.sendEmail(mail, { id: 1, name: 'X', accountConfigs: null } as any, false);

      expect(setDefaultRequestSpy).not.toHaveBeenCalled();
      expect(setApiKeySpy).toHaveBeenCalled();
    });

    it('uses per-account sendgrid_key when provided, falling back to env otherwise', async () => {
      const accountWithKey: any = {
        id: 1,
        name: 'X',
        accountConfigs: [{ accountId: 1, name: 'sendgrid_key', value: 'SG.AccountKey' }],
      };
      const mail: any = { from: { email: 's@s.com' }, subject: 't', content: [], categories: [] };

      await handler.sendEmail(mail, accountWithKey, false);

      expect(setApiKeySpy).toHaveBeenCalledWith('SG.AccountKey');
    });
  });

  describe('error log redaction', () => {
    it('does not stringify the entire SendGrid error (PII guard)', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const sendGridError = {
        code: 401,
        message: 'Unauthorized',
        response: {
          statusCode: 401,
          body: { errors: [{ message: 'invalid auth' }] },
        },
      };
      sendgridSendMock.mockRejectedValueOnce(sendGridError);
      const mail: any = { from: { email: 's@s.com' }, subject: 't', content: [], categories: [] };

      await expect(handler.sendEmail(mail, { id: 1, name: 'X', accountConfigs: null } as any, false)).rejects.toThrow();

      // Find the 'Sendgrid error' log call
      const sendgridErrorCall = consoleSpy.mock.calls.find((c) => c[0] === 'Sendgrid error');
      expect(sendgridErrorCall).toBeDefined();
      const payload = sendgridErrorCall![1];
      // Payload must include only the redacted fields, not the whole error object
      expect(payload).toEqual({
        code: 401,
        message: 'Unauthorized',
        statusCode: 401,
        sendgridErrors: [{ message: 'invalid auth' }],
      });

      consoleSpy.mockRestore();
    });
  });
});
