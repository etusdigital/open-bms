import { GoogleTasksService } from '../../src/google-tasks.service';
import { CloudTasksClient } from '@google-cloud/tasks';
import { StepType } from '../../src/interfaces';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('Google Cloud Tasks Integration Tests', () => {
  let service: GoogleTasksService;
  let mockCloudTasksClient: any;

  const originalEnv = process.env;

  beforeAll(() => {
    // Setup test environment variables
    process.env = {
      ...originalEnv,
      GOOGLE_TASK_PROJECT: 'test-project',
      GOOGLE_TASK_LOCATION: 'us-east1',
      GOOGLE_TASK_QUEUE_TIMER: 'message-trigger-timer',
      GOOGLE_TASK_QUEUE_CONDITION: 'message-trigger-condition',
      GOOGLE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
      GOOGLE_TASK_CALLBACK_URL: 'https://test-callback.run.app',
      SERVICE_ACCOUNT: JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key: 'fake-private-key',
        client_email: 'test@test-project.iam.gserviceaccount.com',
      }),
      NODE_ENV: 'production', // Set to production to test real behavior
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Create mock CloudTasksClient with all required methods
    mockCloudTasksClient = {
      queuePath: jest.fn((project, location, queue) => {
        return `projects/${project}/locations/${location}/queues/${queue}`;
      }),
      createTask: jest.fn(),
    };

    // Mock CloudTasksClient constructor
    jest.spyOn(CloudTasksClient.prototype, 'queuePath').mockImplementation(mockCloudTasksClient.queuePath);
    jest.spyOn(CloudTasksClient.prototype, 'createTask').mockImplementation(mockCloudTasksClient.createTask);

    service = new GoogleTasksService();

    // Override the private client property with our mock
    service['client'] = mockCloudTasksClient as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task Creation', () => {
    it('should create task successfully in production environment', async () => {
      // Arrange
      const mockPayload = JSON.stringify({
        automation: { id: 100, name: 'test-automation' },
        contact: { id: 500, email: 'test@example.com' },
      });
      const waitFor = 5; // 5 minutes
      const urlParams = 'automation=test&step=1';
      const mockTaskResponse = [
        {
          name: 'projects/test-project/locations/us-east1/queues/message-trigger-timer/tasks/12345',
          scheduleTime: { seconds: 1234567890, nanos: 0 },
        },
      ];

      mockCloudTasksClient.createTask.mockResolvedValue(mockTaskResponse);

      // Act
      const result = await service.post({ payload: mockPayload, waitFor }, urlParams, StepType.WAIT);

      // Assert
      expect(result).toEqual(mockTaskResponse);
      expect(mockCloudTasksClient.createTask).toHaveBeenCalledTimes(1);
      expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'message-trigger-timer');
    });

    it('should create task with correct request structure', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'data' });
      const waitFor = 10;
      const urlParams = 'param=value';

      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-123' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor }, urlParams, StepType.EMAIL);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall).toHaveProperty('parent');
      expect(createTaskCall).toHaveProperty('task');
      expect(createTaskCall.task).toHaveProperty('httpRequest');
      expect(createTaskCall.task.httpRequest).toMatchObject({
        httpMethod: 'POST',
        url: 'https://test-callback.run.app/?param=value',
        oidcToken: {
          serviceAccountEmail: 'test@test-project.iam.gserviceaccount.com',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(createTaskCall.task.httpRequest.body).toBe(Buffer.from(mockPayload).toString('base64'));
    });

    it('should create task without URL parameters when not provided', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'data' });
      const waitFor = 0;

      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-456' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor }, '', StepType.EMAIL);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.httpRequest.url).toBe('https://test-callback.run.app/');
    });
  });

  describe('Queue Selection', () => {
    it('should use condition queue for CONDITIONAL_TIME step type', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'conditional' });
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-789' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor: 5 }, 'test=param', StepType.CONDITIONAL_TIME);

      // Assert
      expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'message-trigger-condition');
    });

    it('should use timer queue for WAIT step type', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'wait' });
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-wait' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor: 10 }, '', StepType.WAIT);

      // Assert
      expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'message-trigger-timer');
    });

    it('should use timer queue for EMAIL step type (default)', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'email' });
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-email' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor: 0 }, '', StepType.EMAIL);

      // Assert
      expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'message-trigger-timer');
    });

    it('should construct correct parent path with queue', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'path' });
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-path' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor: 5 }, '', StepType.WAIT);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.parent).toBe('projects/test-project/locations/us-east1/queues/message-trigger-timer');
    });
  });

  describe('Task Scheduling', () => {
    it('should schedule task for immediate execution when waitFor is 0', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'immediate' });
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-immediate' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor: 0 }, '', StepType.EMAIL);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.scheduleTime).toBeUndefined();
    });

    it('should schedule task for immediate execution when waitFor is negative', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'negative' });
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-negative' }]);

      // Act
      await service.post({ payload: mockPayload, waitFor: -5 }, '', StepType.EMAIL);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.scheduleTime).toBeUndefined();
    });

    it('should schedule task for future execution when waitFor is positive', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'future' });
      const waitFor = 15; // 15 minutes
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-future' }]);

      const currentTimestamp = dayjs().tz('America/Sao_Paulo').unix();

      // Act
      await service.post({ payload: mockPayload, waitFor }, '', StepType.WAIT);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.scheduleTime).toBeDefined();
      expect(createTaskCall.task.scheduleTime.seconds).toBeGreaterThanOrEqual(currentTimestamp);
      expect(createTaskCall.task.scheduleTime.seconds).toBeLessThanOrEqual(
        currentTimestamp + waitFor * 60 + 5, // Allow 5 second margin
      );
    });

    it('should calculate correct timestamp for scheduled tasks', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'timestamp' });
      const waitFor = 30; // 30 minutes
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-timestamp' }]);

      const expectedTimestamp = dayjs().tz('America/Sao_Paulo').add(waitFor, 'minute').unix();

      // Act
      await service.post({ payload: mockPayload, waitFor }, '', StepType.WAIT);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.scheduleTime.seconds).toBeGreaterThanOrEqual(expectedTimestamp - 1);
      expect(createTaskCall.task.scheduleTime.seconds).toBeLessThanOrEqual(expectedTimestamp + 1);
    });

    it('should use America/Sao_Paulo timezone for scheduling', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'timezone' });
      const waitFor = 60; // 1 hour
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-timezone' }]);

      const saoPauloTime = dayjs().tz('America/Sao_Paulo').add(waitFor, 'minute').unix();

      // Act
      await service.post({ payload: mockPayload, waitFor }, '', StepType.CONDITIONAL_TIME);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      const scheduledTimestamp = createTaskCall.task.scheduleTime.seconds;

      // Verify timestamp is within expected range (accounting for execution time)
      expect(scheduledTimestamp).toBeGreaterThanOrEqual(saoPauloTime - 2);
      expect(scheduledTimestamp).toBeLessThanOrEqual(saoPauloTime + 2);
    });
  });

  describe('Payload Encoding', () => {
    it('should encode payload as base64', async () => {
      // Arrange
      const originalPayload = JSON.stringify({
        automation: { id: 100 },
        contact: { email: 'encode@test.com' },
      });
      const expectedBase64 = Buffer.from(originalPayload).toString('base64');
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-encode' }]);

      // Act
      await service.post({ payload: originalPayload, waitFor: 0 }, '', StepType.EMAIL);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.httpRequest.body).toBe(expectedBase64);
    });

    it('should handle complex payload with special characters', async () => {
      // Arrange
      const complexPayload = JSON.stringify({
        text: 'Hello "World" with\nnewlines',
        emoji: '😊🎉',
        unicode: 'Olá, 你好',
      });
      const expectedBase64 = Buffer.from(complexPayload).toString('base64');
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-complex' }]);

      // Act
      await service.post({ payload: complexPayload, waitFor: 0 }, '', StepType.EMAIL);

      // Assert
      const createTaskCall = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(createTaskCall.task.httpRequest.body).toBe(expectedBase64);

      // Verify decoding works
      const decoded = Buffer.from(createTaskCall.task.httpRequest.body, 'base64').toString();
      expect(decoded).toBe(complexPayload);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when createTask fails', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'error' });
      const mockError = new Error('Google Cloud Tasks API error');
      mockCloudTasksClient.createTask.mockRejectedValue(mockError);

      // Act & Assert
      // Note: The service returns the promise from createTask without await,
      // so async errors are not caught by the try-catch block
      await expect(service.post({ payload: mockPayload, waitFor: 5 }, '', StepType.EMAIL)).rejects.toThrow('Google Cloud Tasks API error');
    });

    it('should throw error when payload is empty', async () => {
      // Arrange
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-empty' }]);

      // Act & Assert
      await expect(service.post({ payload: '', waitFor: 5 }, '', StepType.EMAIL)).rejects.toThrow('Payload should be informed.');
    });

    it('should throw error when payload is null', async () => {
      // Arrange
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: 'task-null' }]);

      // Act & Assert
      await expect(service.post({ payload: null, waitFor: 5 }, '', StepType.EMAIL)).rejects.toThrow('Payload should be informed.');
    });

    it('should propagate error from createTask', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'error-message' });
      const originalError = new Error('Authentication failed');
      mockCloudTasksClient.createTask.mockRejectedValue(originalError);

      // Act & Assert
      // Note: Async errors from createTask are not caught, so the original error is propagated
      await expect(service.post({ payload: mockPayload, waitFor: 0 }, '', StepType.EMAIL)).rejects.toThrow('Authentication failed');
    });

    it('should propagate network errors', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'network-error' });
      const networkError = new Error('ECONNREFUSED: Connection refused');
      mockCloudTasksClient.createTask.mockRejectedValue(networkError);

      // Act & Assert
      // Note: Network errors from createTask are not transformed
      await expect(service.post({ payload: mockPayload, waitFor: 10 }, '', StepType.WAIT)).rejects.toThrow('ECONNREFUSED: Connection refused');
    });
  });

  describe('Non-Production Environment', () => {
    it('should return mock task when NODE_ENV is not production', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      const testService = new GoogleTasksService();
      const mockPayload = JSON.stringify({ test: 'non-prod' });

      // Act
      const result = await testService.post({ payload: mockPayload, waitFor: 5 }, 'test=param', StepType.EMAIL);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('scheduleTime');
      expect(result[0].scheduleTime).toHaveProperty('seconds');
      expect(result[0].scheduleTime.seconds).toBe(100);
      expect(mockCloudTasksClient.createTask).not.toHaveBeenCalled();

      // Restore environment
      process.env.NODE_ENV = 'production';
    });

    it('should generate random task ID in non-production', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const devService = new GoogleTasksService();
      const mockPayload = JSON.stringify({ test: 'dev' });

      // Act
      const result1 = await devService.post({ payload: mockPayload, waitFor: 0 }, '', StepType.EMAIL);
      const result2 = await devService.post({ payload: mockPayload, waitFor: 0 }, '', StepType.EMAIL);

      // Assert
      expect(result1[0].name).toBeDefined();
      expect(result2[0].name).toBeDefined();
      expect(result1[0].name).not.toBe(result2[0].name); // Should be different random IDs
      expect(result1[0].name.length).toBe(40); // crypto.randomBytes(20).toString('hex')

      // Restore environment
      process.env.NODE_ENV = 'production';
    });
  });

  describe('Return Value', () => {
    it('should return task response from createTask', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'return' });
      const mockTaskResponse = [
        {
          name: 'projects/test-project/locations/us-east1/queues/timer/tasks/abc123',
          scheduleTime: { seconds: 1234567890, nanos: 123456 },
          createTime: { seconds: 1234567800, nanos: 0 },
        },
      ];
      mockCloudTasksClient.createTask.mockResolvedValue(mockTaskResponse);

      // Act
      const result = await service.post({ payload: mockPayload, waitFor: 5 }, '', StepType.WAIT);

      // Assert
      expect(result).toEqual(mockTaskResponse);
    });

    it('should return task ID that can be extracted from response', async () => {
      // Arrange
      const mockPayload = JSON.stringify({ test: 'task-id' });
      const taskName = 'projects/test/locations/us-east1/queues/timer/tasks/unique-task-123';
      mockCloudTasksClient.createTask.mockResolvedValue([{ name: taskName }]);

      // Act
      const result = await service.post({ payload: mockPayload, waitFor: 10 }, '', StepType.EMAIL);

      // Assert
      expect(result[0].name).toBe(taskName);

      // Simulate extracting task ID (as done in app.service.ts)
      const taskId = result[0].name.split('/').pop();
      expect(taskId).toBe('unique-task-123');
    });
  });
});
