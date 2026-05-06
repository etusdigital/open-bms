import { S3StorageProvider } from './s3-storage.provider';
import type { SystemConfigCacheProvider } from './system-config-cache.provider';
import type { S3SystemSettings } from '../lib/integrations-config-file';

function makeCache(settings: S3SystemSettings | null) {
  return {
    get: jest.fn(async () => settings),
    invalidate: jest.fn(),
  } as unknown as SystemConfigCacheProvider;
}

describe('S3StorageProvider', () => {
  it('throws ServiceUnavailableException when settings are missing', async () => {
    const sut = new S3StorageProvider(makeCache(null));
    await expect(sut.getDefaultBucket()).rejects.toThrow(/S3 não configurado/);
  });

  it('reuses the same S3Client across calls when connection fields are unchanged', async () => {
    const settings: S3SystemSettings = {
      bucket: 'msgops-dev',
      accessKeyId: 'AKIA',
      secretAccessKey: 'shhh',
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
    };
    const sut = new S3StorageProvider(makeCache(settings));
    const first = (sut as any).resolve();
    const second = (sut as any).resolve();
    const r1 = await first;
    const r2 = await second;
    expect(r1.client).toBe(r2.client);
    expect(r1.bucket).toBe('msgops-dev');
  });

  it('upload writes under templates path and returns endpoint-prefixed URL', async () => {
    const settings: S3SystemSettings = {
      bucket: 'msgops-dev',
      accessKeyId: 'AKIA',
      secretAccessKey: 'shhh',
      endpoint: 'http://localhost:9100',
      region: 'us-east-1',
    };
    const sut = new S3StorageProvider(makeCache(settings));
    const send = jest.fn().mockResolvedValue({});
    // Force the resolved client's send. Resolve once so cached object exists.
    await (sut as any).resolve();
    (sut as any).cached.resolved.client = { send };

    const file = { name: 'logo.png', mime: 'image/png', buffer: Buffer.from('data') };
    const result = await sut.upload(42, file, 'templates/messages');

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.link).toContain('msgops-dev/templates/messages/42/images/logo.png');
  });

  it('publicUrl uses assetsUrl when present', async () => {
    const settings: S3SystemSettings = {
      bucket: 'msgops-dev',
      accessKeyId: 'AKIA',
      secretAccessKey: 'shhh',
      assetsUrl: 'cdn.example.com',
      region: 'us-east-1',
    };
    const sut = new S3StorageProvider(makeCache(settings));
    const send = jest.fn().mockResolvedValue({});
    await (sut as any).resolve();
    (sut as any).cached.resolved.client = { send };

    const file = { name: 'a.png', mime: 'image/png', buffer: Buffer.from('x') };
    const result = await sut.upload(7, file, 'templates/messages');
    expect(result.link).toMatch(/^https:\/\/cdn\.example\.com\//);
  });
});
