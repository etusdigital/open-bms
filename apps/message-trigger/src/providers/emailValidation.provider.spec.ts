import { Test, TestingModule } from '@nestjs/testing';
import { EmailValidationProvider } from './emailValidation.provider';
import { HttpService } from '@nestjs/axios';
import { InternalServerErrorException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('EmailValidationProvider', () => {
  let provider: EmailValidationProvider;
  let httpService: HttpService;

  const originalEnv = process.env;

  beforeEach(async () => {
    // Set up environment variable
    process.env = {
      ...originalEnv,
      EMAIL_VERIFY_URL: 'https://api.emailverify.com',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailValidationProvider],
    }).compile();

    provider = module.get<EmailValidationProvider>(EmailValidationProvider);
    httpService = provider['httpService'];
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
    });

    it('should initialize HttpService', () => {
      expect(provider['httpService']).toBeDefined();
      expect(provider['httpService']).toBeInstanceOf(HttpService);
    });
  });

  describe('emailChecker', () => {
    const mockEmail = 'test@example.com';
    const mockApiKey = 'test-api-key-123';

    describe('Successful validation', () => {
      it('should validate email and return response data', async () => {
        // Arrange
        const mockResponse = {
          data: {
            email: mockEmail,
            result: 'deliverable',
            score: 95,
            flags: {
              disposable: false,
              role_account: false,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(`https://api.emailverify.com/validate/?email=${encodeURIComponent(mockEmail)}`, {
          headers: {
            'api-key': mockApiKey,
          },
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('should encode email address in URL', async () => {
        // Arrange
        const emailWithSpecialChars = 'user+tag@example.com';
        const mockResponse = {
          data: { result: 'deliverable' },
          status: 200,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(emailWithSpecialChars, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(`https://api.emailverify.com/validate/?email=${encodeURIComponent(emailWithSpecialChars)}`, expect.any(Object));
      });

      it('should include api-key in request headers', async () => {
        // Arrange
        const customApiKey = 'custom-key-xyz-789';
        const mockResponse = { data: { result: 'valid' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(mockEmail, customApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(expect.any(String), {
          headers: {
            'api-key': customApiKey,
          },
        });
      });

      it('should return empty object when response.data is undefined', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(result).toEqual({});
      });

      it('should return empty object when response.data is null', async () => {
        // Arrange
        const mockResponse = {
          data: null,
          status: 200,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(result).toEqual({});
      });

      it('should handle validation result: deliverable', async () => {
        // Arrange
        const mockResponse = {
          data: {
            email: mockEmail,
            result: 'deliverable',
            reason: 'accepted_email',
          },
          status: 200,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(result).toEqual(mockResponse.data);
        expect(result.result).toBe('deliverable');
      });

      it('should handle validation result: undeliverable', async () => {
        // Arrange
        const mockResponse = {
          data: {
            email: 'invalid@nonexistent-domain.com',
            result: 'undeliverable',
            reason: 'invalid_domain',
          },
          status: 200,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker('invalid@nonexistent-domain.com', mockApiKey);

        // Assert
        expect(result.result).toBe('undeliverable');
      });

      it('should handle validation result: risky', async () => {
        // Arrange
        const mockResponse = {
          data: {
            email: mockEmail,
            result: 'risky',
            reason: 'disposable_email',
            flags: { disposable: true },
          },
          status: 200,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(result.result).toBe('risky');
        expect(result.flags.disposable).toBe(true);
      });
    });

    describe('Error handling', () => {
      it('should handle HTTP errors', async () => {
        // Arrange
        const mockError = new Error('Network error');
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(provider.emailChecker(mockEmail, mockApiKey)).rejects.toThrow(InternalServerErrorException);
        expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);

        consoleErrorSpy.mockRestore();
      });

      it('should throw InternalServerErrorException with error details', async () => {
        // Arrange
        const mockError = { message: 'API error', code: 500 };
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(provider.emailChecker(mockEmail, mockApiKey)).rejects.toThrow(`Error to validate email: ${JSON.stringify(mockError)}`);

        consoleErrorSpy.mockRestore();
      });

      it('should log error to console before throwing', async () => {
        // Arrange
        const mockError = new Error('Timeout error');
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(provider.emailChecker(mockEmail, mockApiKey)).rejects.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);

        consoleErrorSpy.mockRestore();
      });

      it('should handle 401 Unauthorized error', async () => {
        // Arrange
        const mockError = {
          response: { status: 401, statusText: 'Unauthorized' },
          message: 'Invalid API key',
        };
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(provider.emailChecker(mockEmail, 'invalid-key')).rejects.toThrow(InternalServerErrorException);

        consoleErrorSpy.mockRestore();
      });

      it('should handle 429 Rate Limit error', async () => {
        // Arrange
        const mockError = {
          response: { status: 429, statusText: 'Too Many Requests' },
          message: 'Rate limit exceeded',
        };
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Act & Assert
        await expect(provider.emailChecker(mockEmail, mockApiKey)).rejects.toThrow(InternalServerErrorException);

        consoleErrorSpy.mockRestore();
      });
    });

    describe('Edge cases', () => {
      it('should handle email with special characters', async () => {
        // Arrange
        const specialEmail = 'user+test@example.com';
        const mockResponse = { data: { result: 'deliverable' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(specialEmail, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(specialEmail)), expect.any(Object));
      });

      it('should handle email with international characters', async () => {
        // Arrange
        const internationalEmail = 'usuário@example.com';
        const mockResponse = { data: { result: 'deliverable' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(internationalEmail, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(internationalEmail)), expect.any(Object));
      });

      it('should handle email with dots and hyphens', async () => {
        // Arrange
        const complexEmail = 'first.last-name@sub-domain.example.com';
        const mockResponse = { data: { result: 'deliverable' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(complexEmail, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(`https://api.emailverify.com/validate/?email=${encodeURIComponent(complexEmail)}`, expect.any(Object));
      });

      it('should handle empty api key', async () => {
        // Arrange
        const mockResponse = { data: { result: 'deliverable' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(mockEmail, '');

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(expect.any(String), {
          headers: {
            'api-key': '',
          },
        });
      });

      it('should handle response with additional metadata', async () => {
        // Arrange
        const mockResponse = {
          data: {
            email: mockEmail,
            result: 'deliverable',
            score: 92,
            flags: {
              disposable: false,
              role_account: false,
              free_email: true,
            },
            metadata: {
              smtp_provider: 'gmail',
              mx_records: ['mx1.example.com', 'mx2.example.com'],
            },
          },
          status: 200,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(result).toEqual(mockResponse.data);
        expect(result.metadata).toBeDefined();
        expect(result.metadata.smtp_provider).toBe('gmail');
      });

      it('should construct correct URL with EMAIL_VERIFY_URL from env', async () => {
        // Arrange
        process.env.EMAIL_VERIFY_URL = 'https://custom-email-api.com';
        provider = new EmailValidationProvider();
        httpService = provider['httpService'];

        const mockResponse = { data: { result: 'valid' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(mockEmail, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(`https://custom-email-api.com/validate/?email=${encodeURIComponent(mockEmail)}`, expect.any(Object));
      });

      it('should handle lowercase and uppercase emails identically', async () => {
        // Arrange
        const uppercaseEmail = 'TEST@EXAMPLE.COM';
        const mockResponse = { data: { result: 'deliverable' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.emailChecker(uppercaseEmail, mockApiKey);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(uppercaseEmail)), expect.any(Object));
      });
    });
  });
});
