import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { AdminS3Service, S3_KEY } from './admin-s3.service';
import type { Repository } from 'typeorm';
import type { SystemConfigEntity } from '../../../entities/system-config.entity';
import type { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';

let tmp: string;
const HEAD_BUCKET_MOCK = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: HEAD_BUCKET_MOCK })),
  HeadBucketCommand: jest.fn().mockImplementation((args) => ({ args })),
  DeleteObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bms-admin-s3-'));
  process.env.BMS_CONFIG_DIR = tmp;
  HEAD_BUCKET_MOCK.mockReset();
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
    findOne: jest.fn(async () => (cacheStore.value ? { key: S3_KEY, value: cacheStore.value } : null)),
  } as unknown as Repository<SystemConfigEntity>;
  return { sut: new AdminS3Service(repo, cache), repo, cache, cacheStore };
}

describe('AdminS3Service', () => {
  it('getSettings returns null when DB empty', async () => {
    const { sut } = makeSut();
    expect(await sut.getSettings()).toBeNull();
  });

  it('saveSettings persists masked secret + writes file', async () => {
    const { sut, cache } = makeSut();
    const result = await sut.saveSettings({
      bucket: 'acme',
      accessKeyId: 'AKIA12345678',
      secretAccessKey: 'super-secret-value',
      region: 'us-east-1',
    });

    expect(result.bucket).toBe('acme');
    expect(result.secretAccessKeyMasked).toContain('***');
    expect(JSON.stringify(result)).not.toContain('super-secret-value');
    expect(cache.invalidate).toHaveBeenCalledWith(S3_KEY);
  });

  it('saveSettings merges existing secret on partial update', async () => {
    const seed = {
      bucket: 'acme',
      accessKeyId: 'AKIAOLD12',
      secretAccessKey: 'OLDSECRET12345',
      region: 'us-east-1',
    };
    const { sut } = makeSut(seed);
    const result = await sut.saveSettings({
      bucket: 'acme-renamed',
      accessKeyId: 'AKIAOLD12',
      // no secretAccessKey
      region: 'us-east-1',
    });
    expect(result.bucket).toBe('acme-renamed');
    expect(result.secretAccessKeyMasked).toContain('***');
  });

  it('saveSettings rejects endpoint change without new secret', async () => {
    const seed = {
      bucket: 'acme',
      accessKeyId: 'AKIAOLD12',
      secretAccessKey: 'OLDSECRET12345',
      endpoint: 'https://s3.amazonaws.com',
      region: 'us-east-1',
    };
    const { sut } = makeSut(seed);
    await expect(
      sut.saveSettings({
        bucket: 'acme',
        accessKeyId: 'AKIAOLD12',
        endpoint: 'http://minio:9000', // different endpoint
        region: 'us-east-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('testConnection returns ok=true on HeadBucket success', async () => {
    HEAD_BUCKET_MOCK.mockResolvedValue({});
    const { sut } = makeSut();
    const result = await sut.testConnection({
      bucket: 'acme',
      accessKeyId: 'AKIA12345678',
      secretAccessKey: 'super-secret-value',
      region: 'us-east-1',
    });
    expect(result.ok).toBe(true);
  });

  it('testConnection returns ok=false on HeadBucket error', async () => {
    HEAD_BUCKET_MOCK.mockRejectedValue(new Error('NoSuchBucket'));
    const { sut } = makeSut();
    const result = await sut.testConnection({
      bucket: 'gone',
      accessKeyId: 'AKIA12345678',
      secretAccessKey: 'super-secret-value',
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('NoSuchBucket');
  });
});
