import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

import { AccountSettingsService } from '../account-settings.service';

const axiosGet = require('axios').default.get as jest.Mock;

function makeSystemRepo() {
  return {
    findOne: jest.fn(),
  } as any;
}

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
  const systemRepo = makeSystemRepo();
  const accountConfigs = makeAccountConfigs();
  const handler = opts.handler ?? makeHandler();
  const service = new AccountSettingsService(systemRepo, accountConfigs, handler);
  return { service, systemRepo, accountConfigs, handler };
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
  afterEach(() => axiosGet.mockReset());

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

    it('returns source=global when account has no key but system_config has one', async () => {
      const { service, systemRepo, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      systemRepo.findOne.mockResolvedValue({ key: 'sendgrid_settings', value: { apiKey: 'SG.global111' } });
      expect(await service.getSendgrid(42)).toEqual({ source: 'global', apiKeyMasked: null, webhookUrl: null });
    });

    it('returns source=global when account has no key but env var is set', async () => {
      const prev = process.env.SENDGRID_API_KEY;
      process.env.SENDGRID_API_KEY = 'SG.fromenv';
      const { service, systemRepo, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      systemRepo.findOne.mockResolvedValue(null);
      try {
        expect(await service.getSendgrid(42)).toEqual({ source: 'global', apiKeyMasked: null, webhookUrl: null });
      } finally {
        if (prev === undefined) delete process.env.SENDGRID_API_KEY;
        else process.env.SENDGRID_API_KEY = prev;
      }
    });

    it('returns source=none when nothing is configured', async () => {
      const prev = process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      const { service, systemRepo, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      systemRepo.findOne.mockResolvedValue(null);
      try {
        expect(await service.getSendgrid(42)).toEqual({ source: 'none', apiKeyMasked: null, webhookUrl: null });
      } finally {
        if (prev !== undefined) process.env.SENDGRID_API_KEY = prev;
      }
    });

    it('never returns plaintext of the global key (clients see source only)', async () => {
      const { service, systemRepo, accountConfigs } = build();
      accountConfigs.getByAccountId.mockResolvedValue(null);
      systemRepo.findOne.mockResolvedValue({ key: 'sendgrid_settings', value: { apiKey: 'SG.SECRET999' } });
      const out = await service.getSendgrid(42);
      expect(JSON.stringify(out)).not.toContain('SECRET');
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
});
