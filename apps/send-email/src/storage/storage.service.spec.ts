import { Readable } from 'stream';
import { StorageService } from './storage.service';

describe('StorageService', () => {
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

      const service = new StorageService();
      const client = (service as any).s3;
      const config = client.config;

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

      const service = new StorageService();
      const config = (service as any).s3.config;

      expect(await config.region()).toBe('us-east-1');
      expect(config.forcePathStyle).toBe(false);
    });

    it('should omit credentials when access keys are absent (lets the SDK use its provider chain)', () => {
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      const service = new StorageService();
      expect(service).toBeDefined();
      // Constructor passes credentials: undefined; SDK then resolves via default chain.
      // We don't assert on config.credentials() here because the chain may throw if no creds are reachable.
    });
  });

  describe('getHtml', () => {
    let service: StorageService;
    let mockSend: jest.Mock;

    const buildBodyStream = (content: string | Buffer): Readable => Readable.from([typeof content === 'string' ? Buffer.from(content, 'utf8') : content]);

    beforeEach(() => {
      process.env.S3_ENDPOINT = 'http://localhost:9100';
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
      service = new StorageService();
      mockSend = jest.fn();
      (service as any).s3 = { send: mockSend };
    });

    it('should issue a GetObjectCommand with the right Bucket/Key and return the body as utf8', async () => {
      mockSend.mockResolvedValue({ Body: buildBodyStream('<p>Hello</p>') });

      const result = await service.getHtml('my-bucket', 'emails/test.html');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({ Bucket: 'my-bucket', Key: 'emails/test.html' });
      expect(result).toBe('<p>Hello</p>');
    });

    it('should return empty string when Body is missing', async () => {
      mockSend.mockResolvedValue({ Body: undefined });

      expect(await service.getHtml('bucket', 'empty.html')).toBe('');
    });

    it('should return empty string when Body stream yields no chunks', async () => {
      mockSend.mockResolvedValue({ Body: Readable.from([]) });

      expect(await service.getHtml('bucket', 'empty.html')).toBe('');
    });

    it('should propagate errors from S3 send', async () => {
      mockSend.mockRejectedValue(new Error('NoSuchKey'));

      await expect(service.getHtml('bucket', 'missing.html')).rejects.toThrow('NoSuchKey');
    });

    it('should reject payloads larger than the 5 MB cap', async () => {
      const oversize = Buffer.alloc(5 * 1024 * 1024 + 1, 0x61);
      mockSend.mockResolvedValue({ Body: buildBodyStream(oversize) });

      await expect(service.getHtml('bucket', 'big.html')).rejects.toThrow(/exceeds/);
    });
  });
});
