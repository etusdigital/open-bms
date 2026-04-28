import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

import { SettingsService } from '../settings.service';

const axiosGet = require('axios').default.get as jest.Mock;

function makeRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn((v) => v),
  } as any;
}

function buildService() {
  const repo = makeRepo();
  const service = new SettingsService(repo);
  return { service, repo };
}

describe('SettingsService', () => {
  afterEach(() => axiosGet.mockReset());

  describe('getSendgrid', () => {
    it('returns null when no sendgrid_settings row exists', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue(null);
      expect(await service.getSendgrid()).toBeNull();
    });

    it('returns null when row has no apiKey', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue({ key: 'sendgrid_settings', value: { webhookBaseUrl: 'https://x' } });
      expect(await service.getSendgrid()).toBeNull();
    });

    it('strips legacy fields (subuserEmail, subuserPrefix, defaultIpPool)', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue({
        key: 'sendgrid_settings',
        value: {
          apiKey: 'SG.legacy',
          subuserEmail: 'old@x.com',
          subuserPrefix: 'bms',
          defaultIpPool: 'pool-1',
          webhookBaseUrl: 'https://app.x/bms/events',
        },
      });
      const out = await service.getSendgrid();
      expect(out).toEqual({ apiKey: 'SG.legacy', webhookBaseUrl: 'https://app.x/bms/events' });
    });

    it('omits webhookBaseUrl when not set', async () => {
      const { service, repo } = buildService();
      repo.findOne.mockResolvedValue({ key: 'sendgrid_settings', value: { apiKey: 'SG.x' } });
      expect(await service.getSendgrid()).toEqual({ apiKey: 'SG.x' });
    });
  });

  describe('saveSendgrid', () => {
    it('writes only apiKey + webhookBaseUrl (overwrite, drops legacy)', async () => {
      const { service, repo } = buildService();
      await service.saveSendgrid({ apiKey: 'SG.new', webhookBaseUrl: 'https://app.x/bms/events' } as any);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'sendgrid_settings',
          value: { apiKey: 'SG.new', webhookBaseUrl: 'https://app.x/bms/events' },
        }),
      );
    });

    it('omits webhookBaseUrl when blank', async () => {
      const { service, repo } = buildService();
      await service.saveSendgrid({ apiKey: 'SG.new' } as any);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'sendgrid_settings',
          value: { apiKey: 'SG.new' },
        }),
      );
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
