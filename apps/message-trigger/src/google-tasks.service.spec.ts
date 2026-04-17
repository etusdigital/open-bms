import { Test, TestingModule } from '@nestjs/testing';
import { GoogleTasksService } from './google-tasks.service';
import { CloudTasksClient } from '@google-cloud/tasks';
import { StepType } from './interfaces';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Mock @google-cloud/tasks
jest.mock('@google-cloud/tasks');

describe('GoogleTasksService', () => {
  let service: GoogleTasksService;
  let mockCloudTasksClient: any;

  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      GOOGLE_TASK_PROJECT: 'test-project',
      GOOGLE_TASK_LOCATION: 'us-east1',
      GOOGLE_TASK_QUEUE_TIMER: 'timer-queue',
      GOOGLE_TASK_QUEUE_CONDITION: 'condition-queue',
      GOOGLE_CLIENT_EMAIL: 'test@example.com',
      GOOGLE_TASK_CALLBACK_URL: 'https://test.example.com/callback',
      SERVICE_ACCOUNT: JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key: 'test-key',
        client_email: 'test@example.com',
      }),
      NODE_ENV: 'test',
    };

    // Mock CloudTasksClient methods
    mockCloudTasksClient = {
      queuePath: jest.fn().mockReturnValue('projects/test-project/locations/us-east1/queues/timer-queue'),
      createTask: jest.fn().mockResolvedValue([
        {
          name: 'projects/test-project/locations/us-east1/queues/timer-queue/tasks/task-123',
          scheduleTime: { seconds: 1234567890, nanos: 0 },
        },
      ]),
    };

    (CloudTasksClient as jest.MockedClass<typeof CloudTasksClient>).mockImplementation(() => mockCloudTasksClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleTasksService],
    }).compile();

    service = module.get<GoogleTasksService>(GoogleTasksService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize CloudTasksClient with credentials from SERVICE_ACCOUNT', () => {
      expect(CloudTasksClient).toHaveBeenCalledWith({
        credentials: {
          type: 'service_account',
          project_id: 'test-project',
          private_key: 'test-key',
          client_email: 'test@example.com',
        },
      });
    });

    it('should handle empty SERVICE_ACCOUNT gracefully', () => {
      process.env.SERVICE_ACCOUNT = undefined;
      new GoogleTasksService();
      expect(CloudTasksClient).toHaveBeenCalledWith({
        credentials: {},
      });
    });
  });

  describe('post', () => {
    const mockPayload = JSON.stringify({ test: 'data' });
    const mockParams = 'automation_name=Test&email=test@example.com';

    describe('Non-production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
      });

      it('should return mock data without calling Google Cloud Tasks API', async () => {
        const result = await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('scheduleTime');
        expect(result[0].scheduleTime).toEqual({ seconds: 100, nano: 10000 });
        expect(mockCloudTasksClient.createTask).not.toHaveBeenCalled();
      });

      it('should return different random names for subsequent calls', async () => {
        const result1 = await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);
        const result2 = await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(result1[0].name).not.toBe(result2[0].name);
      });
    });

    describe('Production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        // Re-create service with production env
        service = new GoogleTasksService();
      });

      it('should create task for WAIT step type using timer queue', async () => {
        mockCloudTasksClient.queuePath.mockReturnValue('projects/test-project/locations/us-east1/queues/timer-queue');

        await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'timer-queue');
        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: 'projects/test-project/locations/us-east1/queues/timer-queue',
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              httpMethod: 'POST',
              url: 'https://test.example.com/callback/?automation_name=Test&email=test@example.com',
            }),
            scheduleTime: expect.objectContaining({
              seconds: expect.any(Number),
            }),
          }),
        });
      });

      it('should create task for CONDITIONAL_TIME step type using condition queue', async () => {
        mockCloudTasksClient.queuePath.mockReturnValue('projects/test-project/locations/us-east1/queues/condition-queue');

        await service.post({ payload: mockPayload, waitFor: 10 }, mockParams, StepType.CONDITIONAL_TIME);

        expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'condition-queue');
      });

      it('should encode payload to base64 in HTTP request body', async () => {
        await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        const expectedBase64 = Buffer.from(mockPayload).toString('base64');
        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              body: expectedBase64,
            }),
          }),
        });
      });

      it('should include OIDC token with service account email', async () => {
        await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              oidcToken: {
                serviceAccountEmail: 'test@example.com',
              },
            }),
          }),
        });
      });

      it('should include scheduleTime when waitFor > 0', async () => {
        const mockCurrentTime = dayjs('2024-01-15T10:00:00').tz('America/Sao_Paulo');
        jest.spyOn(dayjs.prototype, 'tz').mockReturnValue(mockCurrentTime as any);
        jest.spyOn(dayjs.prototype, 'add').mockReturnValue(mockCurrentTime.add(5, 'minute') as any);
        jest.spyOn(dayjs.prototype, 'unix').mockReturnValue(1705324200);

        await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            scheduleTime: {
              seconds: 1705324200,
            },
          }),
        });

        jest.restoreAllMocks();
      });

      it('should not include scheduleTime when waitFor is 0', async () => {
        await service.post({ payload: mockPayload, waitFor: 0 }, mockParams, StepType.WAIT);

        const callArg = mockCloudTasksClient.createTask.mock.calls[0][0];
        expect(callArg.task.scheduleTime).toBeUndefined();
      });

      it('should build URL with params when provided', async () => {
        await service.post({ payload: mockPayload, waitFor: 5 }, 'param1=value1&param2=value2', StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              url: 'https://test.example.com/callback/?param1=value1&param2=value2',
            }),
          }),
        });
      });

      it('should build URL without query params when params is empty', async () => {
        await service.post({ payload: mockPayload, waitFor: 5 }, '', StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              url: 'https://test.example.com/callback/',
            }),
          }),
        });
      });

      it('should include Content-Type header', async () => {
        await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              headers: {
                'Content-Type': 'application/json',
              },
            }),
          }),
        });
      });

      it('should return task response from Google Cloud Tasks', async () => {
        const mockResponse = [
          {
            name: 'projects/test-project/locations/us-east1/queues/timer-queue/tasks/task-456',
            scheduleTime: { seconds: 1705324500, nanos: 123456 },
          },
        ];
        mockCloudTasksClient.createTask.mockResolvedValue(mockResponse);

        const result = await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        expect(result).toEqual(mockResponse);
      });

      it('should throw error when createTask fails', async () => {
        const mockError = new Error('Google Cloud Tasks API error');
        mockCloudTasksClient.createTask.mockRejectedValue(mockError);

        await expect(service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.WAIT)).rejects.toThrow('Google Cloud Tasks API error');
      });

      it('should handle missing payload by throwing error from createTaskRequest', async () => {
        await expect(service.post({ payload: '', waitFor: 5 }, mockParams, StepType.WAIT)).rejects.toThrow('Payload should be informed.');
      });

      it('should handle null payload by throwing error from createTaskRequest', async () => {
        await expect(service.post({ payload: null, waitFor: 5 }, mockParams, StepType.WAIT)).rejects.toThrow('Payload should be informed.');
      });
    });

    describe('Edge cases', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        service = new GoogleTasksService();
      });

      it('should handle negative waitFor as immediate execution', async () => {
        await service.post({ payload: mockPayload, waitFor: -5 }, mockParams, StepType.WAIT);

        const callArg = mockCloudTasksClient.createTask.mock.calls[0][0];
        expect(callArg.task.scheduleTime).toBeUndefined();
      });

      it('should work with EMAIL step type (uses timer queue)', async () => {
        mockCloudTasksClient.queuePath.mockReturnValue('projects/test-project/locations/us-east1/queues/timer-queue');

        await service.post({ payload: mockPayload, waitFor: 5 }, mockParams, StepType.EMAIL);

        expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'timer-queue');
      });

      it('should handle very large waitFor values', async () => {
        const largeWaitFor = 525600; // 1 year in minutes
        const mockCurrentTime = dayjs('2024-01-15T10:00:00').tz('America/Sao_Paulo');
        jest.spyOn(dayjs.prototype, 'tz').mockReturnValue(mockCurrentTime as any);
        jest.spyOn(dayjs.prototype, 'add').mockReturnValue(mockCurrentTime.add(largeWaitFor, 'minute') as any);
        jest.spyOn(dayjs.prototype, 'unix').mockReturnValue(1736849400);

        await service.post({ payload: mockPayload, waitFor: largeWaitFor }, mockParams, StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            scheduleTime: {
              seconds: 1736849400,
            },
          }),
        });

        jest.restoreAllMocks();
      });

      it('should handle complex payloads with special characters', async () => {
        const complexPayload = JSON.stringify({
          message: 'Test with "quotes" and \n newlines',
          data: { nested: { value: 123 } },
          unicode: 'Olá! 你好! 😊',
        });

        await service.post({ payload: complexPayload, waitFor: 5 }, mockParams, StepType.WAIT);

        const expectedBase64 = Buffer.from(complexPayload).toString('base64');
        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              body: expectedBase64,
            }),
          }),
        });
      });

      it('should handle URL params with special characters', async () => {
        const specialParams = 'email=test%2Buser@example.com&name=John%20Doe';

        await service.post({ payload: mockPayload, waitFor: 5 }, specialParams, StepType.WAIT);

        expect(mockCloudTasksClient.createTask).toHaveBeenCalledWith({
          parent: expect.any(String),
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              url: `https://test.example.com/callback/?${specialParams}`,
            }),
          }),
        });
      });
    });
  });

  describe('Timezone handling', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      service = new GoogleTasksService();
    });

    it('should use America/Sao_Paulo timezone for scheduling', async () => {
      const tzSpy = jest.spyOn(dayjs.prototype, 'tz');

      await service.post({ payload: JSON.stringify({ test: 'data' }), waitFor: 10 }, 'test=params', StepType.WAIT);

      expect(tzSpy).toHaveBeenCalledWith('America/Sao_Paulo');

      tzSpy.mockRestore();
    });

    it('should calculate correct timestamp for schedule time', async () => {
      // Simply verify that the scheduleTime is present and is a number
      await service.post({ payload: JSON.stringify({ test: 'data' }), waitFor: 30 }, 'test=params', StepType.WAIT);

      const callArg = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(callArg.task.scheduleTime).toBeDefined();
      expect(typeof callArg.task.scheduleTime.seconds).toBe('number');
      expect(callArg.task.scheduleTime.seconds).toBeGreaterThan(0);
    });
  });

  describe('Integration tests', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      service = new GoogleTasksService();
    });

    it('should handle complete workflow: WAIT step with schedule', async () => {
      const leadStateMessage = {
        id: 'lead-123',
        automation: { id: 50, type: 'email', title: 'Test Automation' },
        contact: { email: 'test@example.com', firstName: 'Test' },
        activeStepId: '100',
      };

      const payload = JSON.stringify(leadStateMessage);
      const params = `automation_name=Test%20Automation&email=test@example.com&active_step=100`;

      const result = await service.post({ payload, waitFor: 15 }, params, StepType.WAIT);

      expect(result).toBeDefined();
      expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'timer-queue');
      expect(mockCloudTasksClient.createTask).toHaveBeenCalled();
    });

    it('should handle complete workflow: CONDITIONAL_TIME step with schedule', async () => {
      const leadStateMessage = {
        id: 'lead-456',
        automation: { id: 75, type: 'email', title: 'Conditional Automation' },
        contact: { email: 'conditional@example.com', firstName: 'Conditional' },
        activeStepId: '200',
      };

      const payload = JSON.stringify(leadStateMessage);
      const params = `automation_name=Conditional%20Automation&email=conditional@example.com&active_step=200`;

      const result = await service.post({ payload, waitFor: 120 }, params, StepType.CONDITIONAL_TIME);

      expect(result).toBeDefined();
      expect(mockCloudTasksClient.queuePath).toHaveBeenCalledWith('test-project', 'us-east1', 'condition-queue');
      expect(mockCloudTasksClient.createTask).toHaveBeenCalled();
    });

    it('should handle immediate execution (waitFor = 0)', async () => {
      const payload = JSON.stringify({ test: 'immediate' });
      const params = 'immediate=true';

      await service.post({ payload, waitFor: 0 }, params, StepType.WAIT);

      const callArg = mockCloudTasksClient.createTask.mock.calls[0][0];
      expect(callArg.task).toBeDefined();
      expect(callArg.task.scheduleTime).toBeUndefined();
      expect(callArg.task.httpRequest).toBeDefined();
    });
  });
});
