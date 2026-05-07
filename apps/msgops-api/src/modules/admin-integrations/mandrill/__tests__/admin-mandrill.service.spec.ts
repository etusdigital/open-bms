import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { AdminMandrillService, MANDRILL_KEY } from '../admin-mandrill.service';
import type { Repository } from 'typeorm';
import type { SystemConfigEntity } from '../../../../entities/system-config.entity';
import type { SystemConfigCacheProvider } from '../../../../providers/system-config-cache.provider';

let tmp: string;

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ status: 200, data: '"PONG!"' }) },
  post: jest.fn().mockResolvedValue({ status: 200, data: '"PONG!"' }),
}));
import axios from 'axios';

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bms-admin-mandrill-'));
  process.env.BMS_CONFIG_DIR = tmp;
  (axios as any).post.mockReset();
  (axios as any).post.mockResolvedValue({ status: 200, data: '"PONG!"' });
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
  return { sut: new AdminMandrillService(repo, cache), cache, cacheStore };
}

describe('AdminMandrillService', () => {
  it('getSettings returns null when DB empty', async () => {
    const { sut } = makeSut();
    expect(await sut.getSettings()).toBeNull();
  });

  it('saveSettings persists, masks api key + webhook key, invalidates cache', async () => {
    const { sut, cache } = makeSut();
    const result = await sut.saveSettings({
      apiKey: 'mdr_0123456789abcdef',
      webhookKey: 'whk_super-secret-mandrill',
    });
    expect(result.apiKeyMasked).toContain('***');
    expect(result.webhookKeyMasked).toContain('***');
    expect(result.metadata?.hasFreeTier).toBe(false);
    expect(cache.invalidate).toHaveBeenCalledWith(MANDRILL_KEY);
    expect(JSON.stringify(result)).not.toContain('whk_super-secret-mandrill');
  });

  it('saveSettings rejects api key shorter than 16 chars', async () => {
    const { sut } = makeSut();
    await expect(sut.saveSettings({ apiKey: 'short' } as any)).rejects.toThrow(BadRequestException);
  });

  it('testConnection ok=true on PONG! response', async () => {
    const { sut } = makeSut({ apiKey: 'mdr_0123456789abcdef' });
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(true);
    expect((axios as any).post).toHaveBeenCalledWith(
      'https://mandrillapp.com/api/1.0/users/ping.json',
      expect.objectContaining({ key: expect.stringMatching(/^mdr_/) }),
      expect.any(Object),
    );
  });

  it('testConnection ok=false on 500 (Mandrill returns 500 for invalid key)', async () => {
    (axios as any).post.mockResolvedValueOnce({ status: 500, data: { status: 'error' } });
    const { sut } = makeSut({ apiKey: 'mdr_0123456789abcdef' });
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/inválidas/i);
  });

  it('testConnection rate-limits per IP (5/min)', async () => {
    const { sut } = makeSut({ apiKey: 'mdr_0123456789abcdef' });
    for (let i = 0; i < 5; i++) await sut.testConnection({}, '8.8.8.8');
    await expect(sut.testConnection({}, '8.8.8.8')).rejects.toThrow();
  });
});
