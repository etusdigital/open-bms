import { Test, TestingModule } from '@nestjs/testing';
import { HttpRequestProvider } from './httpRequest.provider';
import { HttpService } from '@nestjs/axios';
import { TrackerService } from '../tracker/tracker.service';
import { InternalServerErrorException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('HttpRequestProvider', () => {
  let provider: HttpRequestProvider;
  let httpService: HttpService;
  let trackerService: jest.Mocked<TrackerService>;

  beforeEach(async () => {
    const mockTrackerService = {
      log: jest.fn(),
      send: jest.fn(),
      logInfo: jest.fn(),
      logDebug: jest.fn(),
      logError: jest.fn(),
      sendInfo: jest.fn(),
      sendDebug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpRequestProvider, { provide: TrackerService, useValue: mockTrackerService }],
    }).compile();

    provider = module.get<HttpRequestProvider>(HttpRequestProvider);
    trackerService = module.get(TrackerService);

    // Get the httpService instance from the provider
    httpService = provider['httpService'];
  });

  afterEach(() => {
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

  describe('process', () => {
    const mockRoute = 'https://api.example.com/endpoint';
    const mockHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token123',
    };
    const mockPayload = {
      name: 'Test',
      email: 'test@example.com',
      data: { value: 123 },
    };

    describe('GET requests', () => {
      it('should execute GET request without payload', async () => {
        // Arrange
        const mockResponse = {
          data: { id: 1, name: 'Test' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.process('get', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(mockRoute, { headers: mockHeaders });
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', {
          type: 'get',
          route: mockRoute,
          headers: mockHeaders,
          payload: JSON.stringify(mockPayload),
        });
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - response: ', JSON.stringify(mockResponse));
        expect(result).toEqual(mockResponse);
      });

      it('should log request parameters before execution', async () => {
        // Arrange
        const mockResponse = { data: { success: true }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('get', mockRoute, mockHeaders, null);

        // Assert
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', {
          type: 'get',
          route: mockRoute,
          headers: mockHeaders,
          payload: JSON.stringify(null),
        });
      });

      it('should log response after successful execution', async () => {
        // Arrange
        const mockResponse = { data: { result: 'success' }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('get', mockRoute, mockHeaders, null);

        // Assert
        expect(trackerService.log).toHaveBeenNthCalledWith(2, '[HTTP-REQUEST] - response: ', JSON.stringify(mockResponse));
      });
    });

    describe('DELETE requests', () => {
      it('should execute DELETE request without payload', async () => {
        // Arrange
        const mockResponse = {
          data: { deleted: true },
          status: 204,
          statusText: 'No Content',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'delete').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.process('delete', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(httpService.delete).toHaveBeenCalledWith(mockRoute, { headers: mockHeaders });
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', {
          type: 'delete',
          route: mockRoute,
          headers: mockHeaders,
          payload: JSON.stringify(mockPayload),
        });
        expect(result).toEqual(mockResponse);
      });

      it('should log response for DELETE requests', async () => {
        // Arrange
        const mockResponse = { data: null, status: 204 };
        jest.spyOn(httpService, 'delete').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('delete', mockRoute, mockHeaders, null);

        // Assert
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - response: ', JSON.stringify(mockResponse));
      });
    });

    describe('POST requests', () => {
      it('should execute POST request with payload', async () => {
        // Arrange
        const mockResponse = {
          data: { id: 123, created: true },
          status: 201,
          statusText: 'Created',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.process('post', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(mockRoute, mockPayload, { headers: mockHeaders });
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', {
          type: 'post',
          route: mockRoute,
          headers: mockHeaders,
          payload: JSON.stringify(mockPayload),
        });
        expect(result).toEqual(mockResponse);
      });

      it('should not log response for POST requests (different code path)', async () => {
        // Arrange
        const mockResponse = { data: { success: true }, status: 201 };
        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('post', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(trackerService.log).toHaveBeenCalledTimes(1); // Only initial log
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', expect.any(Object));
      });
    });

    describe('PUT requests', () => {
      it('should execute PUT request with payload', async () => {
        // Arrange
        const mockResponse = {
          data: { id: 123, updated: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'put').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.process('put', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(httpService.put).toHaveBeenCalledWith(mockRoute, mockPayload, { headers: mockHeaders });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('PATCH requests', () => {
      it('should execute PATCH request with payload', async () => {
        // Arrange
        const mockResponse = {
          data: { id: 123, patched: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        };
        jest.spyOn(httpService, 'patch').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.process('patch', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(httpService.patch).toHaveBeenCalledWith(mockRoute, mockPayload, { headers: mockHeaders });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Error handling', () => {
      it('should handle GET request errors', async () => {
        // Arrange
        const mockError = new Error('Network error');
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act & Assert
        await expect(provider.process('get', mockRoute, mockHeaders, null)).rejects.toThrow(InternalServerErrorException);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[HTTP-REQUEST] - Error to send:'));

        consoleLogSpy.mockRestore();
      });

      it('should handle POST request errors', async () => {
        // Arrange
        const mockError = new Error('Server error');
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act & Assert
        await expect(provider.process('post', mockRoute, mockHeaders, mockPayload)).rejects.toThrow(InternalServerErrorException);
        expect(consoleLogSpy).toHaveBeenCalled();

        consoleLogSpy.mockRestore();
      });

      it('should log error details before throwing', async () => {
        // Arrange
        const mockError = { message: 'API error', code: 500 };
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act & Assert
        await expect(provider.process('get', mockRoute, mockHeaders, null)).rejects.toThrow();
        expect(consoleLogSpy).toHaveBeenCalledWith(`[HTTP-REQUEST] - Error to send: ${JSON.stringify(mockError)}`);

        consoleLogSpy.mockRestore();
      });

      it('should throw InternalServerErrorException with error details', async () => {
        // Arrange
        const mockError = { message: 'Timeout', code: 'ETIMEDOUT' };
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act & Assert
        await expect(provider.process('post', mockRoute, mockHeaders, mockPayload)).rejects.toThrow(`[HTTP-REQUEST] - Error to send: ${JSON.stringify(mockError)}`);

        consoleLogSpy.mockRestore();
      });
    });

    describe('Edge cases', () => {
      it('should handle empty headers', async () => {
        // Arrange
        const mockResponse = { data: { success: true }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('get', mockRoute, {}, null);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(mockRoute, { headers: {} });
      });

      it('should handle null payload for POST requests', async () => {
        // Arrange
        const mockResponse = { data: { success: true }, status: 200 };
        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('post', mockRoute, mockHeaders, null);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(mockRoute, null, { headers: mockHeaders });
      });

      it('should handle empty payload for POST requests', async () => {
        // Arrange
        const mockResponse = { data: { success: true }, status: 200 };
        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('post', mockRoute, mockHeaders, {});

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(mockRoute, {}, { headers: mockHeaders });
      });

      it('should handle complex nested payloads', async () => {
        // Arrange
        const complexPayload = {
          user: { id: 1, name: 'Test', metadata: { created: Date.now() } },
          items: [
            { id: 1, qty: 5 },
            { id: 2, qty: 3 },
          ],
          settings: { notifications: true, theme: 'dark' },
        };
        const mockResponse = { data: { processed: true }, status: 200 };
        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('post', mockRoute, mockHeaders, complexPayload);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(mockRoute, complexPayload, { headers: mockHeaders });
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', {
          type: 'post',
          route: mockRoute,
          headers: mockHeaders,
          payload: JSON.stringify(complexPayload),
        });
      });

      it('should handle routes with query parameters', async () => {
        // Arrange
        const routeWithParams = 'https://api.example.com/users?page=1&limit=10';
        const mockResponse = { data: { users: [] }, status: 200 };
        jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('get', routeWithParams, mockHeaders, null);

        // Assert
        expect(httpService.get).toHaveBeenCalledWith(routeWithParams, { headers: mockHeaders });
      });

      it('should handle special characters in payload', async () => {
        // Arrange
        const specialPayload = {
          message: 'Hello "World" with\nnewlines\tand\ttabs',
          emoji: '😊🎉',
          unicode: 'Olá, 你好',
        };
        const mockResponse = { data: { success: true }, status: 200 };
        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('post', mockRoute, mockHeaders, specialPayload);

        // Assert
        expect(trackerService.log).toHaveBeenCalledWith('[HTTP-REQUEST] - LOG', {
          type: 'post',
          route: mockRoute,
          headers: mockHeaders,
          payload: JSON.stringify(specialPayload),
        });
      });

      it('should handle custom HTTP methods passed as strings', async () => {
        // Arrange
        const mockResponse = { data: { success: true }, status: 200 };
        jest.spyOn(httpService, 'put').mockReturnValue(of(mockResponse) as any);

        // Act
        await provider.process('put', mockRoute, mockHeaders, mockPayload);

        // Assert
        expect(httpService.put).toHaveBeenCalledWith(mockRoute, mockPayload, { headers: mockHeaders });
      });
    });
  });
});
