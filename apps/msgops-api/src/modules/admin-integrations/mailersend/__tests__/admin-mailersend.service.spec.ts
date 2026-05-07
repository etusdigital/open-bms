import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { AdminMailerSendService, MAILERSEND_KEY } from '../admin-mailersend.service';
import type { Repository } from 'typeorm';
import type { SystemConfigEntity } from '../../../../entities/system-config.entity';
import type { SystemConfigCacheProvider } from '../../../../providers/system-config-cache.provider';

let tmp: string;

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ status: 200, data: { id: 'me' } }) },
  get: jest.fn().mockResolvedValue({ status: 200, data: { id: 'me' } }),
}));
import axios from 'axios';

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bms-admin-mailersend-'));
  process.env.BMS_CONFIG_DIR = tmp;
  (axios as any).get.mockReset();
  (axios as any).get.mockResolvedValue({ status: 200, data: { id: 'me' } });
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  delete process.env.BMS_CONFIG_DIR;
});

function makeSut(seed?: any) {
  const cacheStore: any = { value: seed ?? null };
  const cache = {
    get: jest.fn(async () => cacheStore.value),
    invalidate: jest.fn(async () => undefined),
  } as unknown as SystemConfigCacheProvider;
  const repo = {
    save: jest.fn(async (e: any) => {
      cacheStore.value = e.value;
      return e;
    }),
    create: jest.fn((e: any) => e),
  } as unknown as Repository<SystemConfigEntity>;
  return { sut: new AdminMailerSendService(repo, cache), cache, cacheStore };
}

describe('AdminMailerSendService', () => {
  it('getSettings returns null when DB empty', async () => {
    const { sut } = makeSut();
    expect(await sut.getSettings()).toBeNull();
  });

  it('saveSettings persists, masks api key, invalidates cache', async () => {
    const { sut, cache } = makeSut();
    const result = await sut.saveSettings({
      apiKey: 'mlsn.0123456789abcdef0123456789abcdef',
      webhookSigningSecret: 'sig-secret-12345',
    });

    expect(result.apiKeyMasked).toContain('***');
    expect(result.metadata?.hasFreeTier).toBe(true);
    expect(result.metadata?.hasWebhook).toBe(true);
    expect(cache.invalidate).toHaveBeenCalledWith(MAILERSEND_KEY);
    expect(JSON.stringify(result)).not.toContain('mlsn.0123456789abcdef0123456789abcdef');
  });

  it('saveSettings rejects api key without mlsn. prefix', async () => {
    const { sut } = makeSut();
    await expect(sut.saveSettings({ apiKey: 'bogus.0123456789abcdef0123456789abcdef' } as any)).rejects.toThrow(BadRequestException);
  });

  it('testConnection returns ok=true on 200 from /v1/me', async () => {
    const { sut } = makeSut({ apiKey: 'mlsn.0123456789abcdef0123456789abcdef' });
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(true);
    expect((axios as any).get).toHaveBeenCalledWith(
      'https://api.mailersend.com/v1/me',
      expect.objectContaining({ headers: { Authorization: expect.stringContaining('Bearer mlsn.') } }),
    );
  });

  it('testConnection returns ok=false on 401', async () => {
    (axios as any).get.mockResolvedValueOnce({ status: 401, data: {} });
    const { sut } = makeSut({ apiKey: 'mlsn.0123456789abcdef0123456789abcdef' });
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('inválidas');
  });

  it('testConnection rate-limits per IP', async () => {
    const { sut } = makeSut({ apiKey: 'mlsn.0123456789abcdef0123456789abcdef' });
    // enforceTestRateLimit allows 5 hits/min; 6th should throw.
    for (let i = 0; i < 5; i++) await sut.testConnection({}, '1.2.3.4');
    await expect(sut.testConnection({}, '1.2.3.4')).rejects.toThrow();
  });
});
