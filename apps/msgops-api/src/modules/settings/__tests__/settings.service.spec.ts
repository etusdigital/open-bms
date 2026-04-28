import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

import { SettingsService, maskApiKey } from '../settings.service';

const axiosGet = require('axios').default.get as jest.Mock;

function makeRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn((v) => v),
    delete: jest.fn(),
  } as any;
}

function makeHandler() {
  return {
    invalidateApiKeyCache: jest.fn(),
  } as any;
}

function buildService(opts: { handler?: any } = {}) {
  const repo = makeRepo();
  const handler = opts.handler ?? makeHandler();
  const service = new SettingsService(repo, handler);
  return { service, repo, handler };
}

describe('SettingsService (global SendGrid fallback)', () => {
  afterEach(() => axiosGet.mockReset());

  describe('maskApiKey', () => {
    it('masks all but the last 4 chars', () => {
      expect(maskApiKey('SG.abcdefg1234567xyz9999')).toBe('SG.****...9999');
    });
  });

  describe('getSendgrid', () => {
    it('returns null when no sendgrid_settings row exists', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue(null);
      expect(await service.getSendgrid()).toBeNull();
    });

    it('returns null when row exists but apiKey is missing', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue({ key: 'sendgrid_settings', value: {} });
      expect(await service.getSendgrid()).toBeNull();
    });

    it('returns masked view (no plaintext) when key is set', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue({ key: 'sendgrid_settings', value: { apiKey: 'SG.zzzzz9999' } });
      const out = await service.getSendgrid();
      expect(out).toEqual({ apiKeyMasked: 'SG.****...9999', hasKey: true });
      expect(JSON.stringify(out)).not.toContain('zzzzz');
    });

    it('strips legacy fields silently (no webhookBaseUrl in global)', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue({
        key: 'sendgrid_settings',
        value: {
          apiKey: 'SG.legacy0000',
          subuserEmail: 'old@x.com',
          subuserPrefix: 'bms',
          defaultIpPool: 'pool-1',
          webhookBaseUrl: 'https://old/bms/events',
        },
      });
      const out = await service.getSendgrid();
      expect(out).toEqual({ apiKeyMasked: 'SG.****...0000', hasKey: true });
      expect(out).not.toHaveProperty('webhookBaseUrl');
    });
  });

  describe('saveSendgrid', () => {
    it('persists apiKey only, never registers a webhook (per-account responsibility)', async () => {
      const { service, repo, handler } = buildService();
      const out = await service.saveSendgrid({ apiKey: 'SG.new1234' } as any);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'sendgrid_settings', value: { apiKey: 'SG.new1234' } }));
      expect(out).toEqual({ apiKeyMasked: 'SG.****...1234', hasKey: true });
      expect(handler.invalidateApiKeyCache).toHaveBeenCalledWith('global');
    });

    it('overwrites legacy fields on save (no webhookBaseUrl in stored value)', async () => {
      const { service, repo } = buildService();
      await service.saveSendgrid({ apiKey: 'SG.fresh9999' } as any);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.value).toEqual({ apiKey: 'SG.fresh9999' });
    });
  });

  describe('deleteSendgrid', () => {
    it('removes the row and invalidates the global cache slot', async () => {
      const { service, repo, handler } = buildService();
      await service.deleteSendgrid();
      expect(repo.delete).toHaveBeenCalledWith({ key: 'sendgrid_settings' });
      expect(handler.invalidateApiKeyCache).toHaveBeenCalledWith('global');
    });
  });

  describe('testSendgrid', () => {
    it('delegates to validator on happy path', async () => {
      const { service } = buildService();
      axiosGet.mockResolvedValue({ status: 200, data: { first_name: 'Maria' } });
      const out = await service.testSendgrid('SG.abcdefghij', '1.1.1.1');
      expect(out).toEqual({ accountName: 'Maria' });
    });

    it('rate-limits at 6th attempt within window', async () => {
      const { service } = buildService();
      axiosGet.mockResolvedValue({ status: 200, data: { first_name: 'X' } });
      for (let i = 0; i < 5; i++) {
        await service.testSendgrid('SG.abcdefghij', '9.9.9.9');
      }
      try {
        await service.testSendgrid('SG.abcdefghij', '9.9.9.9');
        throw new Error('expected 6th to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });
});
