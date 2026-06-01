import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

const sesSendMock = jest.fn();
jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({ send: sesSendMock })),
  GetAccountCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

import { AccountSettingsService } from '../account-settings.service';

const axiosGet = require('axios').default.get as jest.Mock;
const axiosPost = require('axios').default.post as jest.Mock;

function makeAccountConfigs() {
  return {
    getByAccountId: jest.fn(),
    upsertByAccountId: jest.fn().mockResolvedValue(undefined),
    deleteByAccountId: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeHandler(opts: { createWebhookOk?: boolean } = { createWebhookOk: true }) {
  return {
    createWebhook: opts.createWebhookOk
      ? jest.fn().mockResolvedValue({ url: 'https://in.bri.us/bms/events/?platform=sendgrid&account=42' })
      : jest.fn().mockRejectedValue(new Error('SendGrid 401: invalid scope user.webhooks.event.settings.create')),
    invalidateApiKeyCache: jest.fn(),
  } as any;
}

function build(opts: { handler?: any } = {}) {
  const accountConfigs = makeAccountConfigs();
  const handler = opts.handler ?? makeHandler();
  const service = new AccountSettingsService(accountConfigs, handler);
  return { service, accountConfigs, handler };
}

const ORIGINAL_BASE = process.env.SENDGRID_WEBHOOK_URL_BASE;

describe('AccountSettingsService', () => {
  beforeEach(() => {
    process.env.SENDGRID_WEBHOOK_URL_BASE = 'https://in.bri.us/bms/events/?platform=sendgrid';
  });
  afterAll(() => {
    if (ORIGINAL_BASE === undefined) delete process.env.SENDGRID_WEBHOOK_URL_BASE;
    else process.env.SENDGRID_WEBHOOK_URL_BASE = ORIGINAL_BASE;
  });
  afterEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    sesSendMock.mockReset();
  });

  describe('getSendgrid', () => {
    it('returns source=account with masked key when account has its own key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) => {
        if (name === 'sendgrid_key') return Promise.resolve({ value: 'SG.zzzzzz1234' });
        if (name === 'sendgrid_webhook_url') return Promise.resolve({ value: 'https://hook?account=42' });
        return Promise.resolve(null);
      });
      const out = await service.getSendgrid(42);
      expect(out).toEqual({ source: 'account', apiKeyMasked: 'SG.****...1234', webhookUrl: 'https://hook?account=42' });
    });

    it('returns source=none when account has no key (no platform-wide fallback exists)', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect(await service.getSendgrid(42)).toEqual({ source: 'none', apiKeyMasked: null, webhookUrl: null });
    });
  });

  describe('saveSendgrid', () => {
    it('registers webhook then persists key + webhook url + invalidates cache', async () => {
      const { service, accountConfigs, handler } = build();
      const out = await service.saveSendgrid(42, { apiKey: 'SG.client9999' });

      expect(handler.createWebhook).toHaveBeenCalledWith({ apiKey: 'SG.client9999', accountId: 42 });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'sendgrid_key', 'SG.client9999');
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'sendgrid_webhook_url', 'https://in.bri.us/bms/events/?platform=sendgrid&account=42');
      expect(handler.invalidateApiKeyCache).toHaveBeenCalledWith(42);
      expect(out).toEqual({
        source: 'account',
        apiKeyMasked: 'SG.****...9999',
        webhookUrl: 'https://in.bri.us/bms/events/?platform=sendgrid&account=42',
      });
    });

    it('rejects with BAD_GATEWAY and DOES NOT save when webhook registration fails', async () => {
      const handler = makeHandler({ createWebhookOk: false });
      const { service, accountConfigs } = build({ handler });
      await expect(service.saveSendgrid(42, { apiKey: 'SG.bad11111' })).rejects.toMatchObject({
        status: HttpStatus.BAD_GATEWAY,
      });
      expect(accountConfigs.upsertByAccountId).not.toHaveBeenCalled();
      expect(handler.invalidateApiKeyCache).not.toHaveBeenCalled();
    });
  });

  describe('deleteSendgrid', () => {
    it('removes both account configs and invalidates cache', async () => {
      const { service, accountConfigs, handler } = build();
      await service.deleteSendgrid(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'sendgrid_key');
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'sendgrid_webhook_url');
      expect(handler.invalidateApiKeyCache).toHaveBeenCalledWith(42);
    });
  });

  describe('testSendgrid', () => {
    it('delegates to validator on happy path', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: { first_name: 'Maria' } });
      expect(await service.testSendgrid('SG.testkey1234', '1.1.1.1')).toEqual({ accountName: 'Maria' });
    });

    it('rate-limits at 6th attempt within window', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: { first_name: 'X' } });
      for (let i = 0; i < 5; i++) await service.testSendgrid('SG.x1234567890', '9.9.9.9');
      try {
        await service.testSendgrid('SG.x1234567890', '9.9.9.9');
        throw new Error('expected 6th to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });

  describe('getMailersend', () => {
    it('returns source=account with masked key when account has its own key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) => {
        if (name === 'mailersend_key') return Promise.resolve({ value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' });
        return Promise.resolve(null);
      });
      const out = await service.getMailersend(42);
      expect(out).toEqual({ source: 'account', apiKeyMasked: 'mls***bbb' });
    });

    it('returns source=none when account has no mailersend key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect(await service.getMailersend(42)).toEqual({ source: 'none', apiKeyMasked: null });
    });
  });

  describe('saveMailersend', () => {
    it('upserts the key and returns masked view', async () => {
      const { service, accountConfigs } = build();
      const apiKey = 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbb';
      const out = await service.saveMailersend(42, { apiKey });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'mailersend_key', apiKey);
      expect(out).toEqual({ source: 'account', apiKeyMasked: 'mls***bbb' });
    });
  });

  describe('deleteMailersend', () => {
    it('removes the mailersend_key row', async () => {
      const { service, accountConfigs } = build();
      await service.deleteMailersend(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'mailersend_key');
    });
  });

  describe('testMailersend', () => {
    it('returns { ok: true } on 200', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: {} });
      expect(await service.testMailersend('mlsn.validkeyxxxxxxxxxxxxxxxxxxxxxxx', '1.2.3.4')).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledWith(
        'https://api.mailersend.com/v1/me',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mlsn.validkeyxxxxxxxxxxxxxxxxxxxxxxx' }),
        }),
      );
    });

    it('returns invalid credentials on 401', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 401 });
      expect(await service.testMailersend('mlsn.bad1xxxxxxxxxxxxxxxxxxxxxxxxxxxx', '1.2.3.4')).toEqual({
        ok: false,
        errorMessage: 'Credenciais inválidas.',
      });
    });

    it('returns HTTP <code> on other non-2xx', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 500 });
      expect(await service.testMailersend('mlsn.serverfailxxxxxxxxxxxxxxxxxxxx', '1.2.3.4')).toEqual({
        ok: false,
        errorMessage: 'HTTP 500',
      });
    });

    it('rate-limits at 6th attempt within window', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: {} });
      const key = 'mlsn.x1234567890xxxxxxxxxxxxxxxxxxxxxx';
      for (let i = 0; i < 5; i++) await service.testMailersend(key, '8.8.8.8');
      try {
        await service.testMailersend(key, '8.8.8.8');
        throw new Error('expected 6th to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });

  describe('getSparkpost', () => {
    it('returns source=account with masked key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) =>
        name === 'sparkpost_key' ? Promise.resolve({ value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' }) : Promise.resolve(null),
      );
      const out = await service.getSparkpost(42);
      expect(out.source).toBe('account');
      expect(out.apiKeyMasked).toContain('bbb');
    });
    it('returns source=none when no key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect(await service.getSparkpost(42)).toEqual({ source: 'none', apiKeyMasked: null });
    });
  });

  describe('saveSparkpost', () => {
    it('upserts sparkpost_key', async () => {
      const { service, accountConfigs } = build();
      const apiKey = 'sparkpost-api-key-xxxxxxxxxxxxxxxxxxxxxxx';
      await service.saveSparkpost(42, { apiKey });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'sparkpost_key', apiKey);
    });
  });

  describe('deleteSparkpost', () => {
    it('removes sparkpost_key', async () => {
      const { service, accountConfigs } = build();
      await service.deleteSparkpost(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'sparkpost_key');
    });
  });

  describe('testSparkpost', () => {
    it('returns ok:true on 200 and sends Authorization header without Bearer', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: {} });
      const apiKey = 'sparkpost-api-key-xxxxxxxxxxxxxxxxxxxxxxx';
      expect(await service.testSparkpost(apiKey, '1.2.3.4')).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledWith('https://api.sparkpost.com/api/v1/account', expect.objectContaining({ headers: { Authorization: apiKey } }));
    });

    it('returns Credenciais inválidas on 401', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 401 });
      expect(await service.testSparkpost('sp-bad-keyxxxxxxxxxxxxxxxxxxxxxxxxxx', '1.2.3.4')).toEqual({
        ok: false,
        errorMessage: 'Credenciais inválidas.',
      });
    });

    it('rate-limits at 6th attempt', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: {} });
      const apiKey = 'sparkpost-rl-keyxxxxxxxxxxxxxxxxxxxxxxxxx';
      for (let i = 0; i < 5; i++) await service.testSparkpost(apiKey, '4.4.4.4');
      await expect(service.testSparkpost(apiKey, '4.4.4.4')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('getResend', () => {
    it('returns source=account', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) =>
        name === 'resend_key' ? Promise.resolve({ value: 're_aaaaaaaaaaaaaaaaaaaaaaaaaaabbb' }) : Promise.resolve(null),
      );
      const out = await service.getResend(42);
      expect(out.source).toBe('account');
    });
    it('returns source=none when no key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect(await service.getResend(42)).toEqual({ source: 'none', apiKeyMasked: null });
    });
  });

  describe('saveResend', () => {
    it('upserts resend_key', async () => {
      const { service, accountConfigs } = build();
      await service.saveResend(42, { apiKey: 're_validkeyxxxxxxxxxxxxxxxx' });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'resend_key', 're_validkeyxxxxxxxxxxxxxxxx');
    });
  });

  describe('deleteResend', () => {
    it('removes resend_key', async () => {
      const { service, accountConfigs } = build();
      await service.deleteResend(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'resend_key');
    });
  });

  describe('testResend', () => {
    it('GETs /domains with Bearer auth and returns ok:true on 200', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: { data: [] } });
      const apiKey = 're_validkeyxxxxxxxxxxxxxxxx';
      expect(await service.testResend(apiKey, '1.2.3.4')).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledWith('https://api.resend.com/domains', expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }) }));
    });

    it('returns Credenciais inválidas on 401', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 401 });
      expect(await service.testResend('re_badkeyxxxxxxxxxxxxxxxxxxxxx', '1.2.3.4')).toEqual({
        ok: false,
        errorMessage: 'Credenciais inválidas.',
      });
    });

    it('rate-limits at 6th attempt', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: { data: [] } });
      for (let i = 0; i < 5; i++) await service.testResend('re_rateLimitedKeyxxxxxxxxxxxxxxxxxxx', '5.5.5.5');
      await expect(service.testResend('re_rateLimitedKeyxxxxxxxxxxxxxxxxxxx', '5.5.5.5')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('getSes', () => {
    it('returns source=account when all 3 rows exist', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) => {
        if (name === 'ses_access_key_id') return Promise.resolve({ value: 'AKIAEXAMPLEKEYAAAAAA' });
        if (name === 'ses_secret_access_key') return Promise.resolve({ value: 'a-very-long-secret-key-1234567890abcdefxx' });
        if (name === 'ses_region') return Promise.resolve({ value: 'us-east-1' });
        return Promise.resolve(null);
      });
      const out = await service.getSes(42);
      expect(out.source).toBe('account');
      expect(out.region).toBe('us-east-1');
      expect(out.accessKeyIdMasked).toBeTruthy();
      expect(out.secretAccessKeyMasked).toBeTruthy();
    });

    it('returns source=none when accessKeyId missing', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect(await service.getSes(42)).toEqual({
        source: 'none',
        accessKeyIdMasked: null,
        secretAccessKeyMasked: null,
        region: null,
      });
    });

    it('returns source=none when only accessKeyId is present (partial-state guard)', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) =>
        name === 'ses_access_key_id' ? Promise.resolve({ value: 'AKIAEXAMPLEKEYAAAAAA' }) : Promise.resolve(null),
      );
      expect(await service.getSes(42)).toEqual({
        source: 'none',
        accessKeyIdMasked: null,
        secretAccessKeyMasked: null,
        region: null,
      });
    });
  });

  describe('saveSes', () => {
    it('upserts 3 rows in order (accessKeyId, secretAccessKey, region)', async () => {
      const { service, accountConfigs } = build();
      await service.saveSes(42, {
        accessKeyId: 'AKIAEXAMPLEKEYAAAAAA',
        secretAccessKey: 'a-very-long-secret-key-1234567890abcdefxx',
        region: 'us-east-1',
      });
      expect(accountConfigs.upsertByAccountId).toHaveBeenNthCalledWith(1, 42, 'ses_access_key_id', 'AKIAEXAMPLEKEYAAAAAA');
      expect(accountConfigs.upsertByAccountId).toHaveBeenNthCalledWith(2, 42, 'ses_secret_access_key', 'a-very-long-secret-key-1234567890abcdefxx');
      expect(accountConfigs.upsertByAccountId).toHaveBeenNthCalledWith(3, 42, 'ses_region', 'us-east-1');
    });
  });

  describe('deleteSes', () => {
    it('removes all 3 SES rows', async () => {
      const { service, accountConfigs } = build();
      await service.deleteSes(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'ses_access_key_id');
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'ses_secret_access_key');
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'ses_region');
    });
  });

  describe('testSes', () => {
    it('returns ok:true when SendingEnabled is true', async () => {
      const { service } = build();
      sesSendMock.mockResolvedValueOnce({ SendingEnabled: true });
      expect(await service.testSes('AKIAEXAMPLEKEYAAAAAA', 'a-very-long-secret-key-1234567890abcdefxx', 'us-east-1', '1.2.3.4')).toEqual({ ok: true });
    });

    it('returns sandbox warning when SendingEnabled is false', async () => {
      const { service } = build();
      sesSendMock.mockResolvedValueOnce({ SendingEnabled: false });
      const out = await service.testSes('AKIAEXAMPLEKEYAAAAAA', 'a-very-long-secret-key-1234567890abcdefxx', 'us-east-1', '1.2.3.4');
      expect(out.ok).toBe(false);
      expect(out.errorMessage).toContain('SendingEnabled=false');
    });

    it('returns Credenciais inválidas on UnrecognizedClientException', async () => {
      const { service } = build();
      const err: any = new Error('The security token included in the request is invalid');
      err.name = 'UnrecognizedClientException';
      sesSendMock.mockRejectedValueOnce(err);
      const out = await service.testSes('AKIAEXAMPLEKEYAAAAAA', 'a-very-long-secret-key-1234567890abcdefxx', 'us-east-1', '1.2.3.4');
      expect(out).toEqual({ ok: false, errorMessage: 'Credenciais inválidas.' });
    });

    it('returns generic message on unknown error (avoids leaking raw SDK details)', async () => {
      const { service } = build();
      const err: any = new Error('request-id=abc123 internal stack trace details');
      err.name = 'WeirdException';
      sesSendMock.mockRejectedValueOnce(err);
      const out = await service.testSes('AKIAEXAMPLEKEYAAAAAA', 'a-very-long-secret-key-1234567890abcdefxx', 'us-east-1', '1.2.3.4');
      expect(out.ok).toBe(false);
      expect(out.errorMessage).not.toContain('request-id');
      expect(out.errorMessage).not.toContain('stack trace');
    });

    it('rate-limits at 6th attempt', async () => {
      const { service } = build();
      sesSendMock.mockResolvedValue({ SendingEnabled: true });
      for (let i = 0; i < 5; i++) {
        await service.testSes('AKIAEXAMPLEKEYAAAAAA', 'a-very-long-secret-key-1234567890abcdefxx', 'us-east-1', '6.6.6.6');
      }
      await expect(service.testSes('AKIAEXAMPLEKEYAAAAAA', 'a-very-long-secret-key-1234567890abcdefxx', 'us-east-1', '6.6.6.6')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('getMandrill', () => {
    it('returns source=account', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) =>
        name === 'mandrill_key' ? Promise.resolve({ value: 'mandrill-key-1234567890xxx' }) : Promise.resolve(null),
      );
      const out = await service.getMandrill(42);
      expect(out.source).toBe('account');
    });
    it('returns source=none when no key', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect(await service.getMandrill(42)).toEqual({ source: 'none', apiKeyMasked: null });
    });
  });

  describe('saveMandrill', () => {
    it('upserts mandrill_key', async () => {
      const { service, accountConfigs } = build();
      await service.saveMandrill(42, { apiKey: 'mandrill-key-validxxxx' });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'mandrill_key', 'mandrill-key-validxxxx');
    });
  });

  describe('deleteMandrill', () => {
    it('removes mandrill_key', async () => {
      const { service, accountConfigs } = build();
      await service.deleteMandrill(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalledWith(42, 'mandrill_key');
    });
  });

  describe('testMandrill', () => {
    it('POSTs /users/ping.json with key in body and returns ok:true on exact PONG!', async () => {
      const { service } = build();
      axiosPost.mockResolvedValueOnce({ status: 200, data: 'PONG!' });
      const apiKey = 'mandrill-key-validxxxx';
      expect(await service.testMandrill(apiKey, '1.2.3.4')).toEqual({ ok: true });
      expect(axiosPost).toHaveBeenCalledWith('https://mandrillapp.com/api/1.0/users/ping.json', { key: apiKey }, expect.objectContaining({ timeout: 10_000 }));
    });

    it('rejects non-exact PONG variants (e.g. "PONGS", "NOT-PONG!")', async () => {
      const { service } = build();
      axiosPost.mockResolvedValueOnce({ status: 200, data: 'PONGS' });
      const out = await service.testMandrill('mandrill-key-validxxxx', '1.2.3.4');
      expect(out.ok).toBe(false);
    });

    it('returns Credenciais inválidas on 401', async () => {
      const { service } = build();
      axiosPost.mockResolvedValueOnce({ status: 401 });
      expect(await service.testMandrill('mandrill-bad-keyxxx', '1.2.3.4')).toEqual({
        ok: false,
        errorMessage: 'Credenciais inválidas.',
      });
    });

    it('rate-limits at 6th attempt', async () => {
      const { service } = build();
      axiosPost.mockResolvedValue({ status: 200, data: 'PONG!' });
      for (let i = 0; i < 5; i++) await service.testMandrill('mandrill-rl-keyxxxx', '7.7.7.7');
      await expect(service.testMandrill('mandrill-rl-keyxxxx', '7.7.7.7')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });
  });

  describe('getSparkpostLegacyStatus', () => {
    const ORIGINAL_SPARKPOST_ENV = process.env.SPARKPOST_API_KEY;
    afterEach(() => {
      if (ORIGINAL_SPARKPOST_ENV === undefined) delete process.env.SPARKPOST_API_KEY;
      else process.env.SPARKPOST_API_KEY = ORIGINAL_SPARKPOST_ENV;
    });

    it('returns legacyDetected:false when env is absent', async () => {
      delete process.env.SPARKPOST_API_KEY;
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      const out = await service.getSparkpostLegacyStatus(42);
      expect(out).toEqual({ legacyDetected: false, envValuePresent: false, perAccountConfigured: false });
    });

    it('returns legacyDetected:true when env present + per-account absent', async () => {
      process.env.SPARKPOST_API_KEY = 'env-spk-key';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      const out = await service.getSparkpostLegacyStatus(42);
      expect(out).toEqual({ legacyDetected: true, envValuePresent: true, perAccountConfigured: false });
    });

    it('returns legacyDetected:false when env present + per-account configured', async () => {
      process.env.SPARKPOST_API_KEY = 'env-spk-key';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue({ value: 'per-account-key' });
      const out = await service.getSparkpostLegacyStatus(42);
      expect(out).toEqual({ legacyDetected: false, envValuePresent: true, perAccountConfigured: true });
    });

    it('treats empty/whitespace env value as absent', async () => {
      process.env.SPARKPOST_API_KEY = '   ';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      const out = await service.getSparkpostLegacyStatus(42);
      expect(out.envValuePresent).toBe(false);
      expect(out.legacyDetected).toBe(false);
    });

    it('treats the docker-compose dev placeholder as absent (no wizard in OSS dev)', async () => {
      // docker-compose.yml seeds SPARKPOST_API_KEY with this literal so the SDK boots;
      // it must NOT engage the legacy migration wizard.
      process.env.SPARKPOST_API_KEY = 'dev-placeholder-not-a-real-key';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      const out = await service.getSparkpostLegacyStatus(42);
      expect(out.envValuePresent).toBe(false);
      expect(out.legacyDetected).toBe(false);
    });
  });

  describe('migrateSparkpostLegacy', () => {
    const ORIGINAL_SPARKPOST_ENV = process.env.SPARKPOST_API_KEY;
    afterEach(() => {
      if (ORIGINAL_SPARKPOST_ENV === undefined) delete process.env.SPARKPOST_API_KEY;
      else process.env.SPARKPOST_API_KEY = ORIGINAL_SPARKPOST_ENV;
    });

    it('writes key + sets default when env present and per-account absent', async () => {
      process.env.SPARKPOST_API_KEY = 'env-spk-key';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) => {
        if (name === 'sparkpost_key') return Promise.resolve(null);
        if (name === 'default_email_provider') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      const out = await service.migrateSparkpostLegacy(42);
      expect(out).toEqual({ legacyDetected: false, envValuePresent: true, perAccountConfigured: true });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'sparkpost_key', 'env-spk-key');
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'default_email_provider', 'sparkpost');
    });

    it('preserves existing default_email_provider when already set', async () => {
      process.env.SPARKPOST_API_KEY = 'env-spk-key';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) => {
        if (name === 'sparkpost_key') return Promise.resolve(null);
        if (name === 'default_email_provider') return Promise.resolve({ value: 'mailersend' });
        return Promise.resolve(null);
      });
      await service.migrateSparkpostLegacy(42);
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'sparkpost_key', 'env-spk-key');
      expect(accountConfigs.upsertByAccountId).not.toHaveBeenCalledWith(42, 'default_email_provider', 'sparkpost');
    });

    it('no-ops when per-account already configured', async () => {
      process.env.SPARKPOST_API_KEY = 'env-spk-key';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, name: string) =>
        name === 'sparkpost_key' ? Promise.resolve({ value: 'per-account-key' }) : Promise.resolve(null),
      );
      const out = await service.migrateSparkpostLegacy(42);
      expect(out).toEqual({ legacyDetected: false, envValuePresent: true, perAccountConfigured: true });
      expect(accountConfigs.upsertByAccountId).not.toHaveBeenCalled();
    });

    it('throws BAD_REQUEST when env is absent', async () => {
      delete process.env.SPARKPOST_API_KEY;
      const { service } = build();
      await expect(service.migrateSparkpostLegacy(42)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('throws BAD_REQUEST when env is the docker-compose dev placeholder', async () => {
      process.env.SPARKPOST_API_KEY = 'dev-placeholder-not-a-real-key';
      const { service } = build();
      await expect(service.migrateSparkpostLegacy(42)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  // Mirror of the cross-field guard on the WRITE path (AccountsService.updateAccountConfig
  // for default_email_provider): the DELETE path must symmetrically refuse to leave the
  // account pointing at a provider with no credentials. Backstops the UI confirm dialog.
  describe('delete<Provider> — refuses to remove credentials of the current default', () => {
    const PROVIDER_CASES: Array<{ name: string; label: string; method: keyof AccountSettingsService }> = [
      { name: 'sparkpost', label: 'SparkPost', method: 'deleteSparkpost' },
      { name: 'sendgrid', label: 'SendGrid', method: 'deleteSendgrid' },
      { name: 'mailersend', label: 'MailerSend', method: 'deleteMailersend' },
      { name: 'resend', label: 'Resend', method: 'deleteResend' },
      { name: 'ses', label: 'Amazon SES', method: 'deleteSes' },
      { name: 'mandrill', label: 'Mandrill', method: 'deleteMandrill' },
    ];

    it.each(PROVIDER_CASES)('rejects deleting $name when it is the current default_email_provider', async ({ name, label, method }) => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, key: string) => (key === 'default_email_provider' ? Promise.resolve({ value: name }) : Promise.resolve(null)));
      await expect((service[method] as (id: number) => Promise<void>)(42)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        message: expect.stringContaining(label),
      });
      expect(accountConfigs.deleteByAccountId).not.toHaveBeenCalled();
    });

    it.each(PROVIDER_CASES)('allows deleting $name when default_email_provider is unset', async ({ name, method }) => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      await (service[method] as (id: number) => Promise<void>)(42);
      // SES deletes 3 keys; others delete 1 (sendgrid also deletes webhook URL, so 2).
      // Just verify deleteByAccountId was called at least once with the provider's key family.
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalled();
      expect(name).toBeTruthy();
    });

    it.each(PROVIDER_CASES)('allows deleting $name when another provider is the current default', async ({ name, method }) => {
      const otherProvider = name === 'sparkpost' ? 'mailersend' : 'sparkpost';
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, key: string) =>
        key === 'default_email_provider' ? Promise.resolve({ value: otherProvider }) : Promise.resolve(null),
      );
      await (service[method] as (id: number) => Promise<void>)(42);
      expect(accountConfigs.deleteByAccountId).toHaveBeenCalled();
    });
  });

  // ── Twilio (AC1-AC7, AC11) ──
  describe('Twilio', () => {
    const SID = 'AC' + 'a'.repeat(32);
    const API_SID = 'SK' + 'b'.repeat(32);
    const MG = 'MG' + 'c'.repeat(32);

    it('saveTwilio upserts the correct account_config slots (AC1, AC3, AC4)', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      await service.saveTwilio(42, { accountSid: SID, apiSid: API_SID, apiSecret: 'secret-value-1234', authToken: 'auth-token-1234', smsServiceSid: MG, whatsappServiceSid: MG });
      const written = accountConfigs.upsertByAccountId.mock.calls.map((c: any[]) => c[1]);
      expect(written).toEqual(
        expect.arrayContaining(['twilio_sid_account', 'twilio_sid', 'twilio_secret', 'twilio_auth_account', 'twilio_sms_service', 'twilio_whatsapp_service']),
      );
    });

    it('getTwilio masks the SID and never returns the secret (AC2)', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockImplementation((_id: number, key: string) => {
        const map: Record<string, any> = {
          twilio_sid_account: { value: SID },
          twilio_secret: { value: 'secret-value-1234' },
          twilio_sms_service: { value: MG },
        };
        return Promise.resolve(map[key] ?? null);
      });
      const view = await service.getTwilio(42);
      expect(view.source).toBe('account');
      expect(view.hasSecret).toBe(true);
      expect(view.hasSms).toBe(true);
      expect(view.hasWhatsapp).toBe(false);
      expect(JSON.stringify(view)).not.toContain('secret-value-1234');
    });

    it('getTwilio returns source=none when nothing configured', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      expect((await service.getTwilio(42)).source).toBe('none');
    });

    it('testTwilio returns ok=true on 2xx (AC6)', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: {} });
      expect(await service.testTwilio({ accountSid: SID, apiSid: API_SID, apiSecret: 'x'.repeat(16) }, '1.1.1.1')).toEqual({ ok: true });
    });

    it('testTwilio returns ok=false (no throw) on 401 (AC5)', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 401, data: {} });
      const res = await service.testTwilio({ accountSid: SID, apiSid: API_SID, apiSecret: 'x'.repeat(16) }, '1.1.1.2');
      expect(res.ok).toBe(false);
      expect(res.errorMessage).toBeTruthy();
    });

    it('testTwilio enforces the per-IP rate limit (AC11)', async () => {
      const { service } = build();
      axiosGet.mockResolvedValue({ status: 200, data: {} });
      const ip = 'rate-test-ip';
      for (let i = 0; i < 5; i++) await service.testTwilio({ accountSid: SID, apiSid: API_SID, apiSecret: 'x'.repeat(16) }, ip);
      await expect(service.testTwilio({ accountSid: SID, apiSid: API_SID, apiSecret: 'x'.repeat(16) }, ip)).rejects.toBeDefined();
    });
  });

  // ── Push (AC8, AC11) ──
  describe('Push', () => {
    const validSa = JSON.stringify({ project_id: 'p', private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----', client_email: 'a@b.c' });

    it('savePush writes firebase_service_account_app (AC8)', async () => {
      const { service, accountConfigs } = build();
      const res = await service.savePush(42, { firebaseServiceAccount: validSa });
      expect(accountConfigs.upsertByAccountId).toHaveBeenCalledWith(42, 'firebase_service_account_app', validSa);
      expect(res.source).toBe('account');
    });

    it('getPush returns platform when no account config but env present', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      const prev = process.env.FIREBASE_SERVICE_ACCOUNT;
      process.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id":"platform"}';
      expect((await service.getPush(42)).source).toBe('platform');
      if (prev === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
      else process.env.FIREBASE_SERVICE_ACCOUNT = prev;
    });

    it('getPush returns none when neither account nor env present', async () => {
      const { service, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      const prev = process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      expect((await service.getPush(42)).source).toBe('none');
      if (prev !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT = prev;
    });

    it('testPush validates the service account JSON', async () => {
      const { service } = build();
      expect((await service.testPush(validSa, '2.2.2.1')).ok).toBe(true);
      expect((await service.testPush('{"project_id":"p"}', '2.2.2.2')).ok).toBe(false);
    });
  });
});
