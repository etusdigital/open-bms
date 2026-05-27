import { Test, TestingModule } from '@nestjs/testing';
import { TrackerService } from './tracker.service';
import { HttpService } from '@nestjs/axios';
import { MsgopsEvent, TrackerRequest, TrackerParams } from './tracker.interface';
import { of, throwError } from 'rxjs';

describe('TrackerService', () => {
  let service: TrackerService;
  let httpService: jest.Mocked<HttpService>;

  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      LOG_LEVEL: undefined,
      CLOUD_RUN: undefined,
      PORT: undefined,
      K_REVISION: undefined,
      K_CONFIGURATION: undefined,
    };

    // Create mock HttpService
    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TrackerService, { provide: HttpService, useValue: mockHttpService }],
    }).compile();

    service = module.get<TrackerService>(TrackerService);
    httpService = module.get(HttpService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize HttpService', () => {
      expect(service['httpService']).toBeDefined();
      expect(httpService).toBeDefined();
    });

    it('should set logLevel to null when LOG_LEVEL is not defined', () => {
      expect(service.logLevel).toBeNull();
    });

    it('should set logLevel from environment variable', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const newService = new TrackerService(httpService);
      expect(newService.logLevel).toBe('DEBUG');
    });

    it('should read uri from PIXEL_EVENT_STORE_URL env var', () => {
      process.env.PIXEL_EVENT_STORE_URL = 'https://pixel.example.com/store';
      const newService = new TrackerService(httpService);
      expect(newService.uri).toBe('https://pixel.example.com/store');
      delete process.env.PIXEL_EVENT_STORE_URL;
    });

    it('should default uri to empty string when PIXEL_EVENT_STORE_URL is not set', () => {
      expect(service.uri).toBe('');
    });
  });

  describe('getParameters', () => {
    const mockTrackerRequest: TrackerRequest = {
      email: 'test@example.com',
      automation_name: 'Test Automation',
      automation_type: 'email',
      automation_version: '1.0.0',
      active_step: 1,
      active_step_type: 'email',
      message_id: 'msg-123',
    };

    it('should merge params with cloud environment variables', () => {
      // Arrange
      process.env.CLOUD_RUN = 'production';
      process.env.PORT = '8080';
      process.env.K_REVISION = 'rev-001';
      process.env.K_CONFIGURATION = 'config-001';
      const startedAt = 1234567890;
      const event = MsgopsEvent.MSGOPS_LEAD_ENTRY;

      // Act
      const result = service.getParameters(event, mockTrackerRequest, startedAt);

      // Assert
      expect(result).toMatchObject({
        ...mockTrackerRequest,
        cloud_run: 'production',
        PORT: '8080',
        k_revision: 'rev-001',
        k_configuration: 'config-001',
        started_at: startedAt,
        event: MsgopsEvent.MSGOPS_LEAD_ENTRY,
      });
      expect(result.event_time).toBeDefined();
      expect(typeof result.event_time).toBe('number');
    });

    it('should use "local" defaults when environment variables are not set', () => {
      // Arrange
      const startedAt = 1234567890;
      const event = MsgopsEvent.MSGOPS_RECEIVED_LEAD;

      // Act
      const result = service.getParameters(event, mockTrackerRequest, startedAt);

      // Assert
      expect(result.cloud_run).toBe('local');
      expect(result.PORT).toBe('local');
      expect(result.k_revision).toBe('local');
      expect(result.k_configuration).toBe('local');
    });

    it('should include event_time as current timestamp', () => {
      // Arrange
      const startedAt = 1234567890;
      const event = MsgopsEvent.MSGOPS_STARTED_ACTIVE_STEP;
      const beforeTime = Date.now();

      // Act
      const result = service.getParameters(event, mockTrackerRequest, startedAt);

      // Assert
      const afterTime = Date.now();
      expect(result.event_time).toBeGreaterThanOrEqual(beforeTime);
      expect(result.event_time).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve all tracker request fields', () => {
      // Arrange
      const fullRequest: TrackerRequest = {
        email: 'full@example.com',
        automation_name: 'Full Automation',
        automation_type: 'sms',
        automation_version: '2.0.0',
        active_step: 5,
        active_step_type: 'wait',
        sengrid_response: 'success',
        email_file: 'template.html',
        utm_campaign: 'summer-campaign',
        message_id: 'msg-456',
        list_id: 'list-789',
        cloud_task_id: 'task-111',
        cloud_task_schedule_time: '2024-01-15T10:00:00Z',
      };
      const startedAt = 9876543210;
      const event = MsgopsEvent.MSGOPS_SEND_EMAIL;

      // Act
      const result = service.getParameters(event, fullRequest, startedAt);

      // Assert
      expect(result.email).toBe('full@example.com');
      expect(result.automation_name).toBe('Full Automation');
      expect(result.automation_type).toBe('sms');
      expect(result.automation_version).toBe('2.0.0');
      expect(result.active_step).toBe(5);
      expect(result.active_step_type).toBe('wait');
      expect(result.sengrid_response).toBe('success');
      expect(result.email_file).toBe('template.html');
      expect(result.utm_campaign).toBe('summer-campaign');
      expect(result.message_id).toBe('msg-456');
      expect(result.list_id).toBe('list-789');
      expect(result.cloud_task_id).toBe('task-111');
      expect(result.cloud_task_schedule_time).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('getKey', () => {
    it('should generate key with email, automation name, and started_at', () => {
      // Act
      const result = service.getKey('user@example.com', 'Welcome Email', 1234567890);

      // Assert
      expect(result).toBe('user@example.com:Welcome Email:1234567890');
    });

    it('should handle special characters in email', () => {
      // Act
      const result = service.getKey('user+tag@example.com', 'Test', 111);

      // Assert
      expect(result).toBe('user+tag@example.com:Test:111');
    });

    it('should handle spaces in automation name', () => {
      // Act
      const result = service.getKey('test@example.com', 'Multi Word Automation', 222);

      // Assert
      expect(result).toBe('test@example.com:Multi Word Automation:222');
    });

    it('should handle zero timestamp', () => {
      // Act
      const result = service.getKey('test@example.com', 'Automation', 0);

      // Assert
      expect(result).toBe('test@example.com:Automation:0');
    });
  });

  describe('getPixel', () => {
    const baseUri = 'https://pixel.example.com/store?namespace=msgops&dataframe=msgops_tracker';

    const mockTrackerParams: TrackerParams = {
      email: 'test@example.com',
      automation_name: 'Test Automation',
      automation_type: 'email',
      automation_version: '1.0.0',
      cloud_run: 'production',
      PORT: '8080',
      k_revision: 'rev-001',
      k_configuration: 'config-001',
      started_at: 1234567890,
      event: MsgopsEvent.MSGOPS_LEAD_ENTRY,
      event_time: 1234567900,
    };

    it('should build pixel URL with all required parameters', () => {
      // Act
      const result = service.getPixel('msgops', 'test-key', mockTrackerParams, baseUri);

      // Assert
      expect(result).toContain('&publisher=msgops');
      expect(result).toContain('&tracker_key=test-key');
      expect(result).toContain('&event=MSGOPS_LEAD_ENTRY');
      expect(result).toContain('&event_time=1234567900');
      expect(result).toContain('&automation_name=Test Automation');
      expect(result).toContain('&automation_type=email');
      expect(result).toContain('&email=test@example.com');
      expect(result).toContain('&port=8080');
      expect(result).toContain('&k_revision=rev-001');
      expect(result).toContain('&k_configuration=config-001');
    });

    it('should include optional parameters when present', () => {
      // Arrange
      const paramsWithOptionals: TrackerParams = {
        ...mockTrackerParams,
        active_step: 5,
        active_step_type: 'email',
        sengrid_response: 'success',
        email_file: 'template.html',
        utm_campaign: 'summer',
        message_id: 'msg-123',
        list_id: 'list-456',
        cloud_task_id: 'task-789',
        cloud_task_schedule_time: '2024-01-15T10:00:00Z',
      };

      // Act
      const result = service.getPixel('msgops', 'test-key', paramsWithOptionals, baseUri);

      // Assert
      expect(result).toContain('&active_step=5');
      expect(result).toContain('&active_step_type=email');
      expect(result).toContain('&sengrid_response=success');
      expect(result).toContain('&email_file=template.html');
      expect(result).toContain('&utm_campaign=summer');
      expect(result).toContain('&message_id=msg-123');
      expect(result).toContain('&list_id=list-456');
      expect(result).toContain('&cloud_task_id=task-789');
      expect(result).toContain('&cloud_task_schedule_time=2024-01-15T10:00:00Z');
    });

    it('should use empty string for missing optional parameters', () => {
      // Act
      const result = service.getPixel('msgops', 'test-key', mockTrackerParams, baseUri);

      // Assert
      expect(result).toContain('&active_step=');
      expect(result).toContain('&active_step_type=');
      expect(result).toContain('&sengrid_response=');
      expect(result).toContain('&email_file=');
      expect(result).toContain('&utm_campaign=');
      expect(result).toContain('&message_id=');
      expect(result).toContain('&list_id=');
      expect(result).toContain('&cloud_task_id=');
      expect(result).toContain('&cloud_task_schedule_time=');
    });

    it('should start with base URI', () => {
      // Act
      const result = service.getPixel('msgops', 'test-key', mockTrackerParams, baseUri);

      // Assert
      expect(result.startsWith(baseUri)).toBe(true);
    });

    it('should handle custom URI', () => {
      // Arrange
      const customUri = 'https://custom-tracker.com/pixel';

      // Act
      const result = service.getPixel('custom', 'key-123', mockTrackerParams, customUri);

      // Assert
      expect(result.startsWith(customUri)).toBe(true);
      expect(result).toContain('&publisher=custom');
    });
  });

  describe('send', () => {
    const mockTrackerRequest: TrackerRequest = {
      email: 'test@example.com',
      automation_name: 'Test Automation',
      automation_type: 'email',
      automation_version: '1.0.0',
    };

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      (console.log as jest.Mock).mockRestore();
    });

    it('should not log when LOG_LEVEL is not INFO or DEBUG', () => {
      // Arrange
      service.logLevel = null;
      const event = MsgopsEvent.MSGOPS_LEAD_ENTRY;
      const startedAt = 1234567890;

      // Act
      service.send(event, mockTrackerRequest, startedAt);

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log when LOG_LEVEL is INFO', () => {
      // Arrange
      service.logLevel = 'INFO';
      const event = MsgopsEvent.MSGOPS_RECEIVED_LEAD;
      const startedAt = 1234567890;

      // Act
      service.send(event, mockTrackerRequest, startedAt);

      // Assert
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('TrackerService:'));
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      // Arrange
      service.logLevel = 'DEBUG';
      const event = MsgopsEvent.MSGOPS_STARTED_ACTIVE_STEP;
      const startedAt = 1234567890;

      // Act
      service.send(event, mockTrackerRequest, startedAt);

      // Assert
      expect(console.log).toHaveBeenCalled();
    });

    it('should use Date.now() when started_at is not provided', () => {
      // Arrange
      service.logLevel = 'INFO';
      const event = MsgopsEvent.MSGOPS_SEND_EMAIL;
      const beforeTime = Date.now();

      // Act
      service.send(event, mockTrackerRequest, null);

      // Assert
      const callArg = (console.log as jest.Mock).mock.calls[0][0];
      const loggedData = JSON.parse(callArg.replace('TrackerService: ', ''));
      expect(loggedData.started_at).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should include key in logged output', () => {
      // Arrange
      service.logLevel = 'DEBUG';
      const event = MsgopsEvent.MSGOPS_CREATED_CLOUD_TASK;
      const startedAt = 1234567890;

      // Act
      service.send(event, mockTrackerRequest, startedAt);

      // Assert
      const callArg = (console.log as jest.Mock).mock.calls[0][0];
      const loggedData = JSON.parse(callArg.replace('TrackerService: ', ''));
      expect(loggedData.key).toBe('test@example.com:Test Automation:1234567890');
    });

    it('should include formatted parameters in logged output', () => {
      // Arrange
      service.logLevel = 'INFO';
      const event = MsgopsEvent.MSGOPS_SENDGRID_RESPONSE;
      const startedAt = 1234567890;
      process.env.CLOUD_RUN = 'test-cloud-run';

      // Act
      service.send(event, mockTrackerRequest, startedAt);

      // Assert
      const callArg = (console.log as jest.Mock).mock.calls[0][0];
      const loggedData = JSON.parse(callArg.replace('TrackerService: ', ''));
      expect(loggedData.email).toBe('test@example.com');
      expect(loggedData.automation_name).toBe('Test Automation');
      expect(loggedData.event).toBe(MsgopsEvent.MSGOPS_SENDGRID_RESPONSE);
      expect(loggedData.cloud_run).toBe('test-cloud-run');
    });
  });

  describe('sendPixel', () => {
    const mockTrackerParams: TrackerParams = {
      email: 'test@example.com',
      automation_name: 'Test Automation',
      automation_type: 'email',
      automation_version: '1.0.0',
      cloud_run: 'production',
      PORT: '8080',
      k_revision: 'rev-001',
      k_configuration: 'config-001',
      started_at: 1234567890,
      event: MsgopsEvent.MSGOPS_LEAD_ENTRY,
      event_time: 1234567900,
    };

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      (console.log as jest.Mock).mockRestore();
      (console.error as jest.Mock).mockRestore();
    });

    it('should make HTTP GET request to pixel URL', () => {
      // Arrange
      const mockResponse = { data: 'success' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

      // Act
      service.sendPixel('msgops', 'test-key', mockTrackerParams);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining(service.uri));
    });

    it('should log on successful HTTP request', (done) => {
      // Arrange
      const mockResponse = { data: 'success' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

      // Act
      service.sendPixel('msgops', 'test-key', mockTrackerParams);

      // Assert - Give time for observable to complete
      setTimeout(() => {
        expect(console.log).toHaveBeenCalledWith('Tracker Service: done');
        done();
      }, 100);
    });

    it('should handle HTTP errors gracefully', (done) => {
      // Arrange
      const mockError = new Error('Network error');
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError) as any);

      // Act
      service.sendPixel('msgops', 'test-key', mockTrackerParams);

      // Assert - Give time for observable to emit error
      setTimeout(() => {
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Tracker Service: something wrong occurred'));
        done();
      }, 100);
    });

    it('should include tracker key in pixel URL', () => {
      // Arrange
      const mockResponse = { data: 'success' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

      // Act
      service.sendPixel('msgops', 'custom-tracker-key-123', mockTrackerParams);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('&tracker_key=custom-tracker-key-123'));
    });

    it('should include publisher in pixel URL', () => {
      // Arrange
      const mockResponse = { data: 'success' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);

      // Act
      service.sendPixel('custom-publisher', 'key-123', mockTrackerParams);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('&publisher=custom-publisher'));
    });
  });

  describe('log', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      (console.log as jest.Mock).mockRestore();
    });

    it('should not log when LOG_LEVEL is not INFO or DEBUG', () => {
      // Arrange
      service.logLevel = null;

      // Act
      service.log('Test Title', 'Test message');

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log when LOG_LEVEL is INFO', () => {
      // Arrange
      service.logLevel = 'INFO';

      // Act
      service.log('Test Title', 'Test message');

      // Assert
      expect(console.log).toHaveBeenCalledWith('Test Title: ', 'Test message');
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      // Arrange
      service.logLevel = 'DEBUG';

      // Act
      service.log('Debug Title', 'Debug message');

      // Assert
      expect(console.log).toHaveBeenCalledWith('Debug Title: ', 'Debug message');
    });

    it('should stringify object text', () => {
      // Arrange
      service.logLevel = 'INFO';
      const objectData = { key: 'value', number: 123 };

      // Act
      service.log('Object Test', objectData);

      // Assert
      expect(console.log).toHaveBeenCalledWith('Object Test: ', JSON.stringify(objectData));
    });

    it('should log string text directly', () => {
      // Arrange
      service.logLevel = 'DEBUG';

      // Act
      service.log('String Test', 'Simple string message');

      // Assert
      expect(console.log).toHaveBeenCalledWith('String Test: ', 'Simple string message');
    });

    it('should handle nested objects', () => {
      // Arrange
      service.logLevel = 'INFO';
      const nestedObject = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      };

      // Act
      service.log('Nested Test', nestedObject);

      // Assert
      expect(console.log).toHaveBeenCalledWith('Nested Test: ', JSON.stringify(nestedObject));
    });

    it('should handle arrays', () => {
      // Arrange
      service.logLevel = 'DEBUG';
      const arrayData = [1, 2, 3, 'four', { five: 5 }];

      // Act
      service.log('Array Test', arrayData);

      // Assert
      expect(console.log).toHaveBeenCalledWith('Array Test: ', JSON.stringify(arrayData));
    });

    it('should handle empty string', () => {
      // Arrange
      service.logLevel = 'INFO';

      // Act
      service.log('Empty String', '');

      // Assert
      expect(console.log).toHaveBeenCalledWith('Empty String: ', '');
    });

    it('should handle null', () => {
      // Arrange
      service.logLevel = 'DEBUG';

      // Act
      service.log('Null Test', null);

      // Assert
      // null is treated as an object, so it gets stringified to "null"
      expect(console.log).toHaveBeenCalledWith('Null Test: ', 'null');
    });

    it('should handle undefined', () => {
      // Arrange
      service.logLevel = 'INFO';

      // Act
      service.log('Undefined Test', undefined);

      // Assert
      expect(console.log).toHaveBeenCalledWith('Undefined Test: ', undefined);
    });

    it('should not log when LOG_LEVEL is WARNING', () => {
      // Arrange
      service.logLevel = 'WARNING';

      // Act
      service.log('Warning Test', 'Should not log');

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log when LOG_LEVEL is ERROR', () => {
      // Arrange
      service.logLevel = 'ERROR';

      // Act
      service.log('Error Test', 'Should not log');

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle tracker params with all optional fields undefined', () => {
      // Arrange
      const minimalParams: TrackerParams = {
        email: 'minimal@example.com',
        automation_name: 'Minimal',
        automation_type: 'email',
        automation_version: '1.0.0',
        cloud_run: 'local',
        PORT: 'local',
        k_revision: 'local',
        k_configuration: 'local',
        started_at: 123,
        event: MsgopsEvent.MSGOPS_LEAD_ENTRY,
        event_time: 456,
      };

      // Act
      const pixelUrl = service.getPixel('msgops', 'key', minimalParams, service.uri);

      // Assert
      expect(pixelUrl).toContain('&active_step=');
      expect(pixelUrl).toContain('&active_step_type=');
      expect(pixelUrl).toContain('&email=minimal@example.com');
    });

    it('should handle very long automation names', () => {
      // Arrange
      const longName = 'A'.repeat(1000);
      const key = service.getKey('test@example.com', longName, 123);

      // Assert
      expect(key).toContain(longName);
      expect(key.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in tracker key', () => {
      // Arrange
      const mockResponse = { data: 'success' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse) as any);
      const mockParams: TrackerParams = {
        email: 'test@example.com',
        automation_name: 'Test',
        automation_type: 'email',
        automation_version: '1.0.0',
        cloud_run: 'local',
        PORT: 'local',
        k_revision: 'local',
        k_configuration: 'local',
        started_at: 123,
        event: MsgopsEvent.MSGOPS_LEAD_ENTRY,
        event_time: 456,
      };

      // Act
      service.sendPixel('pub', 'key:with:colons', mockParams);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('&tracker_key=key:with:colons'));
    });
  });
});
