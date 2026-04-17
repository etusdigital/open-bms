import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let mockDownload: jest.Mock;
  let mockFile: jest.Mock;
  let mockBucket: jest.Mock;

  beforeEach(() => {
    process.env.SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });

    mockDownload = jest.fn();
    mockFile = jest.fn().mockReturnValue({ download: mockDownload });
    mockBucket = jest.fn().mockReturnValue({ file: mockFile });

    service = new StorageService();
    // Override the private storage property
    (service as any).storage = { bucket: mockBucket };
  });

  afterEach(() => {
    delete process.env.SERVICE_ACCOUNT;
  });

  describe('constructor', () => {
    it('should create Storage instance with credentials from env', () => {
      expect(service).toBeDefined();
    });

    it('should default to empty object when SERVICE_ACCOUNT is not set', () => {
      delete process.env.SERVICE_ACCOUNT;
      const svc = new StorageService();
      expect(svc).toBeDefined();
    });
  });

  describe('getHtml', () => {
    it('should download file from the correct bucket and filename', async () => {
      const htmlContent = Buffer.from('<p>Hello</p>', 'utf8');
      mockDownload.mockResolvedValue([htmlContent]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.getHtml('my-bucket', 'emails/test.html');

      expect(mockBucket).toHaveBeenCalledWith('my-bucket');
      expect(mockFile).toHaveBeenCalledWith('emails/test.html');
      expect(mockDownload).toHaveBeenCalled();
      expect(result).toBe('<p>Hello</p>');
      expect(consoleSpy).toHaveBeenCalledWith('Log - getHtml', 'emails/test.html');

      consoleSpy.mockRestore();
    });

    it('should return empty string when file content is empty', async () => {
      mockDownload.mockResolvedValue([Buffer.from('', 'utf8')]);
      jest.spyOn(console, 'log').mockImplementation();

      const result = await service.getHtml('bucket', 'empty.html');

      expect(result).toBe('');
    });

    it('should propagate errors from GCS download', async () => {
      mockDownload.mockRejectedValue(new Error('File not found'));
      jest.spyOn(console, 'log').mockImplementation();

      await expect(service.getHtml('bucket', 'missing.html')).rejects.toThrow('File not found');
    });
  });
});
