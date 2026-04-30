import { S3StorageProvider } from './s3-storage.provider';

describe('S3StorageProvider', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('constructor', () => {
    it('should configure S3Client with endpoint, region, credentials and forcePathStyle when env is fully set', async () => {
      process.env.S3_ENDPOINT = 'http://localhost:9100';
      process.env.S3_REGION = 'sa-east-1';
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';

      const provider = new S3StorageProvider();
      const config = (provider as any).s3.config;

      expect(await config.endpoint()).toMatchObject({ hostname: 'localhost', port: 9100 });
      expect(await config.region()).toBe('sa-east-1');
      expect(await config.credentials()).toMatchObject({ accessKeyId: 'test-key', secretAccessKey: 'test-secret' });
      expect(config.forcePathStyle).toBe(true);
    });

    it('should default region to us-east-1 and disable forcePathStyle when no endpoint is set', async () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_REGION;
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';

      const config = (new S3StorageProvider() as any).s3.config;

      expect(await config.region()).toBe('us-east-1');
      expect(config.forcePathStyle).toBe(false);
    });
  });

  describe('upload', () => {
    let provider: S3StorageProvider;
    let mockSend: jest.Mock;

    beforeEach(() => {
      process.env.S3_ENDPOINT = 'http://localhost:9100';
      process.env.S3_BUCKET = 'msgops-dev';
      delete process.env.BMS_ASSETS_URL;
      provider = new S3StorageProvider();
      mockSend = jest.fn().mockResolvedValue({});
      (provider as any).s3 = { send: mockSend };
    });

    it('should put the object under the templates path and return a public URL built from the endpoint', async () => {
      const file = { name: 'logo.png', mime: 'image/png', buffer: Buffer.from('data') };
      const result = await provider.upload(42, file, 'templates/messages');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input).toMatchObject({
        Bucket: 'msgops-dev',
        Key: 'templates/messages/42/images/logo.png',
        ContentType: 'image/png',
        ACL: 'public-read',
      });
      expect(result.link).toBe('http://localhost:9100/msgops-dev/templates/messages/42/images/logo.png');
    });

    it('should prefer BMS_ASSETS_URL as the public host', async () => {
      process.env.BMS_ASSETS_URL = 'assets.example.com';
      const file = { name: 'a.png', mime: 'image/png', buffer: Buffer.from('x') };
      const result = await provider.upload(1, file, 'templates/messages');
      expect(result.link).toBe('https://assets.example.com/templates/messages/1/images/a.png');
    });

    it('should reject uploads larger than the 10 MB cap', async () => {
      const file = { name: 'big.png', mime: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) };
      await expect(provider.upload(1, file)).rejects.toThrow(/exceeds/);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('genericUpload', () => {
    let provider: S3StorageProvider;
    let mockSend: jest.Mock;

    beforeEach(() => {
      process.env.S3_BUCKET = 'msgops-dev';
      process.env.BMS_ASSETS_URL = 'assets.example.com';
      provider = new S3StorageProvider();
      mockSend = jest.fn().mockResolvedValue({});
      (provider as any).s3 = { send: mockSend };
    });

    it('should use the explicit bucket arg over S3_BUCKET and apply public-read only when isPublic', async () => {
      const file = { name: 'sw.js', mime: 'application/javascript', content: 'console.log(1);' };
      await provider.genericUpload(file, 'sw.js', 'bms/push', 'override-bucket', true);

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input).toMatchObject({ Bucket: 'override-bucket', Key: 'bms/push/sw.js', ACL: 'public-read' });
    });

    it('should omit ACL when isPublic is falsy', async () => {
      const file = { name: 'p.png', mime: 'image/png', buffer: Buffer.from('x') };
      await provider.genericUpload(file, 'p.png', 'private', undefined, false);
      expect(mockSend.mock.calls[0][0].input.ACL).toBeUndefined();
    });

    it('should accept string content via the content field', async () => {
      const file = { name: 'sw.js', mime: 'application/javascript', content: 'hello' };
      await provider.genericUpload(file, 'sw.js', 'bms/push');
      expect(mockSend.mock.calls[0][0].input.Body).toEqual(Buffer.from('hello', 'utf8'));
    });
  });

  describe('writeContentIntoBucketFile', () => {
    let provider: S3StorageProvider;
    let mockSend: jest.Mock;

    beforeEach(() => {
      process.env.S3_BUCKET = 'msgops-dev';
      process.env.BMS_ASSETS_URL = 'assets.example.com';
      provider = new S3StorageProvider();
      mockSend = jest.fn().mockResolvedValue({});
      (provider as any).s3 = { send: mockSend };
    });

    it('should upload as text/html', async () => {
      const result = await provider.writeContentIntoBucketFile(7, '<p>hi</p>');
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input).toMatchObject({ Bucket: 'msgops-dev', Key: 'templates/messages/7/template.html', ContentType: 'text/html', ACL: 'public-read' });
      expect(result.fileURLPath).toBe('https://assets.example.com/templates/messages/7/template.html');
    });

    it('should write into the auto-delete-in-1-day folder when isTemporary', async () => {
      await provider.writeContentIntoBucketFile(9, 'x', true);
      expect(mockSend.mock.calls[0][0].input.Key).toBe('templates/auto-delete-in-1-day/9/template.html');
    });

    it('should reject HTML payloads larger than 5 MB to match send-email read cap', async () => {
      const oversize = 'a'.repeat(5 * 1024 * 1024 + 1);
      await expect(provider.writeContentIntoBucketFile(7, oversize)).rejects.toThrow(/exceeds 5242880/);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should send a DeleteObjectCommand with path/hash key', async () => {
      process.env.S3_BUCKET = 'msgops-dev';
      const provider = new S3StorageProvider();
      const mockSend = jest.fn().mockResolvedValue({});
      (provider as any).s3 = { send: mockSend };

      await provider.delete({ path: 'tmp/msgops', hash: 'abc.png' });

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input).toEqual({ Bucket: 'msgops-dev', Key: 'tmp/msgops/abc.png' });
    });

    it('should swallow NoSuchKey errors to keep delete idempotent', async () => {
      process.env.S3_BUCKET = 'msgops-dev';
      const provider = new S3StorageProvider();
      const notFound = Object.assign(new Error('not found'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
      (provider as any).s3 = { send: jest.fn().mockRejectedValue(notFound) };

      await expect(provider.delete({ path: 'tmp/msgops', hash: 'gone.png' })).resolves.toBeUndefined();
    });

    it('should rethrow non-404 errors', async () => {
      process.env.S3_BUCKET = 'msgops-dev';
      const provider = new S3StorageProvider();
      const denied = Object.assign(new Error('denied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
      (provider as any).s3 = { send: jest.fn().mockRejectedValue(denied) };

      await expect(provider.delete({ path: 'x', hash: 'y' })).rejects.toThrow('denied');
    });
  });

  describe('S3_USE_OBJECT_ACLS', () => {
    beforeEach(() => {
      process.env.S3_BUCKET = 'msgops-dev';
      delete process.env.BMS_ASSETS_URL;
    });

    it('should omit ACL on public uploads when S3_USE_OBJECT_ACLS=false', async () => {
      process.env.S3_USE_OBJECT_ACLS = 'false';
      const provider = new S3StorageProvider();
      const mockSend = jest.fn().mockResolvedValue({});
      (provider as any).s3 = { send: mockSend };

      await provider.upload(1, { name: 'a.png', mime: 'image/png', buffer: Buffer.from('x') });

      expect(mockSend.mock.calls[0][0].input.ACL).toBeUndefined();
    });

    it('should set ACL public-read on public uploads when S3_USE_OBJECT_ACLS is unset (default true)', async () => {
      delete process.env.S3_USE_OBJECT_ACLS;
      const provider = new S3StorageProvider();
      const mockSend = jest.fn().mockResolvedValue({});
      (provider as any).s3 = { send: mockSend };

      await provider.upload(1, { name: 'a.png', mime: 'image/png', buffer: Buffer.from('x') });

      expect(mockSend.mock.calls[0][0].input.ACL).toBe('public-read');
    });
  });
});
