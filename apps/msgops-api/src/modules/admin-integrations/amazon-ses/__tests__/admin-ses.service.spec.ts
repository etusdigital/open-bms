import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { AdminSesService, SES_KEY } from '../admin-ses.service';
import type { Repository } from 'typeorm';
import type { SystemConfigEntity } from '../../../../entities/system-config.entity';
import type { SystemConfigCacheProvider } from '../../../../providers/system-config-cache.provider';

const mockSdkSend = jest.fn();
jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({ send: mockSdkSend })),
  GetAccountCommand: jest.fn().mockImplementation((args) => ({ args })),
}));

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bms-admin-ses-'));
  process.env.BMS_CONFIG_DIR = tmp;
  mockSdkSend.mockReset();
  mockSdkSend.mockResolvedValue({ SendingEnabled: true, ProductionAccessEnabled: true });
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
  return { sut: new AdminSesService(repo, cache), cache, cacheStore };
}

const VALID_SETTINGS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
};

describe('AdminSesService', () => {
  it('getSettings returns null when DB empty', async () => {
    const { sut } = makeSut();
    expect(await sut.getSettings()).toBeNull();
  });

  it('saveSettings persists, masks both keys, invalidates cache', async () => {
    const { sut, cache } = makeSut();
    const result = await sut.saveSettings(VALID_SETTINGS);
    expect(result.accessKeyIdMasked).toContain('***');
    expect(result.secretAccessKeyMasked).toContain('***');
    expect(result.metadata?.hasFreeTier).toBe(false);
    expect(cache.invalidate).toHaveBeenCalledWith(SES_KEY);
    expect(JSON.stringify(result)).not.toContain(VALID_SETTINGS.secretAccessKey);
  });

  it('saveSettings rejects access key id missing AKIA/ASIA prefix', async () => {
    const { sut } = makeSut();
    await expect(
      sut.saveSettings({
        accessKeyId: 'BOGUSXXXXXXXXXXXXXXX',
        secretAccessKey: VALID_SETTINGS.secretAccessKey,
        region: 'us-east-1',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('saveSettings rejects unsupported region', async () => {
    const { sut } = makeSut();
    await expect(sut.saveSettings({ ...VALID_SETTINGS, region: 'mars-1' } as any)).rejects.toThrow(BadRequestException);
  });

  it('testConnection ok=true when GetAccount returns SendingEnabled=true', async () => {
    const { sut } = makeSut(VALID_SETTINGS);
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(true);
    expect(mockSdkSend).toHaveBeenCalled();
  });

  it('testConnection flags sandboxed/paused account', async () => {
    mockSdkSend.mockResolvedValueOnce({ SendingEnabled: false });
    const { sut } = makeSut(VALID_SETTINGS);
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/sandbox|pausada/i);
  });

  it('testConnection translates UnrecognizedClientException to "Credenciais inválidas"', async () => {
    mockSdkSend.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { name: 'UnrecognizedClientException' }));
    const { sut } = makeSut(VALID_SETTINGS);
    const result = await sut.testConnection({}, '127.0.0.1');
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/inválidas/i);
  });

  it('testConnection rate-limits per IP (5/min)', async () => {
    const { sut } = makeSut(VALID_SETTINGS);
    for (let i = 0; i < 5; i++) await sut.testConnection({}, '9.9.9.9');
    await expect(sut.testConnection({}, '9.9.9.9')).rejects.toThrow();
  });
});
