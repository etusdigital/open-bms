import { EmailValidationProvider } from './emailValidation.provider';
import { of, throwError } from 'rxjs';

describe('EmailValidationProvider', () => {
  let provider: EmailValidationProvider;
  let originalEnv: string;

  beforeEach(() => {
    originalEnv = process.env.EMAIL_VERIFY_URL;
    process.env.EMAIL_VERIFY_URL = 'https://verify.example.com';
    provider = new EmailValidationProvider();
  });

  afterEach(() => {
    process.env.EMAIL_VERIFY_URL = originalEnv;
  });

  describe('emailChecker', () => {
    it('should return response data on success', async () => {
      const mockResponse = { data: { result: 'deliverable', reason: 'accepted_email' } };
      const httpServiceMock = { get: jest.fn().mockReturnValue(of(mockResponse)) };
      (provider as any).httpService = httpServiceMock;

      const result = await provider.emailChecker('test@example.com', 'api-key-123');

      expect(result).toEqual({ result: 'deliverable', reason: 'accepted_email' });
      expect(httpServiceMock.get).toHaveBeenCalledWith('https://verify.example.com/validate/?email=test%40example.com', { headers: { 'api-key': 'api-key-123' } });
    });

    it('should return empty object when response data is falsy', async () => {
      const mockResponse = { data: null };
      const httpServiceMock = { get: jest.fn().mockReturnValue(of(mockResponse)) };
      (provider as any).httpService = httpServiceMock;

      const result = await provider.emailChecker('test@example.com', 'key');

      expect(result).toEqual({});
    });

    it('should return empty EmailChecker on error', async () => {
      const spyConsole = jest.spyOn(console, 'log').mockImplementation();
      const httpServiceMock = { get: jest.fn().mockReturnValue(throwError(() => new Error('Network error'))) };
      (provider as any).httpService = httpServiceMock;

      const result = await provider.emailChecker('test@example.com', 'key');

      expect(result).toEqual({});
      spyConsole.mockRestore();
    });

    it('should encode email in the URL', async () => {
      const mockResponse = { data: { result: 'deliverable' } };
      const httpServiceMock = { get: jest.fn().mockReturnValue(of(mockResponse)) };
      (provider as any).httpService = httpServiceMock;

      await provider.emailChecker('user+tag@example.com', 'key');

      expect(httpServiceMock.get).toHaveBeenCalledWith(expect.stringContaining('user%2Btag%40example.com'), expect.any(Object));
    });
  });
});
