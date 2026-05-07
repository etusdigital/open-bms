import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { AdminResendService, RESEND_KEY } from '../admin-resend.service';
import type { Repository } from 'typeorm';
import type { SystemConfigEntity } from '../../../../entities/system-config.entity';
import type { SystemConfigCacheProvider } from '../../../../providers/system-config-cache.provider';

let tmp: string;

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ status: 200, data: [] }) },
  get: jest.fn().mockResolvedValue({ status: 200, data: [] }),
}));
import axios from 'axios';

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bms-admin-resend-'));
  process.env.BMS_CONFIG_DIR = tmp;
  (axios as any).get.mockReset();
  (axios as any).get.mockResolvedValue({ status: 200, data: [] });
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
  return { sut: new AdminResendService(repo, cache), cache, cacheStore };
}

describe('AdminResendService', () => {
  it('getSettings returns null when DB empty', async () => {
    const { sut } = makeSut();
    expect(await sut.getSettings()).toBeNull();
  });

  it('saveSettings persists, masks api key, invalidates cache', async () => {
    const { sut, cache } = makeSut();
    const result = await sut.saveSettings({
      apiKey: 're_0123456789abcdef0123456789',
      webhookSigningSecret: 'whsec_super-secret-svix',
    });

    expect(result.apiKeyMasked).toContain('***');
    expect(result.metadata?.hasFreeTier).toBe(true);
    expect(cache.invalidate).toHaveBeenCalledWith(RESEND_KEY);
    expect(JSON.stringify(result)).not.toContain('whsec_super-secret-svix');
  });

  it('saveSettings rejects api key without re_ prefix', async () => {
    const { sut } = makeSut();
    await expect(sut.saveSettings({ apiKey: 'bogus_0123456789abcdef0123' } as any)).rejects.toThrow(BadRequestException);
  });

  it('testConnection returns ok=true on 200 from /domains', async () => {
    const { sut } = makeSut({ apiKey: 're_0123456789abcdef0123456789' });
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(true);
    expect((axios as any).get).toHaveBeenCalledWith(
      'https://api.resend.com/domains',
      expect.objectContaining({ headers: { Authorization: expect.stringContaining('Bearer re_') } }),
    );
  });

  it('testConnection returns ok=false on 401', async () => {
    (axios as any).get.mockResolvedValueOnce({ status: 401, data: {} });
    const { sut } = makeSut({ apiKey: 're_0123456789abcdef0123456789' });
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(false);
  });

  it('testConnection rate-limits per IP', async () => {
    const { sut } = makeSut({ apiKey: 're_0123456789abcdef0123456789' });
    for (let i = 0; i < 5; i++) await sut.testConnection({}, '5.6.7.8');
    await expect(sut.testConnection({}, '5.6.7.8')).rejects.toThrow();
  });
});
