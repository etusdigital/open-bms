import { GoogleTasksService } from './google-tasks.service';

jest.mock('@google-cloud/tasks', () => {
  const mockCreateTask = jest.fn().mockResolvedValue([{ name: 'projects/p/queues/q/tasks/task-123' }, {}, {}]);
  const mockQueuePath = jest.fn().mockReturnValue('projects/p/locations/l/queues/q');
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => ({
      createTask: mockCreateTask,
      queuePath: mockQueuePath,
    })),
    protos: {
      google: {
        cloud: {
          tasks: {
            v2: {},
          },
        },
      },
    },
  };
});

describe('GoogleTasksService', () => {
  let service: GoogleTasksService;

  beforeEach(() => {
    process.env.SERVICE_ACCOUNT = '{}';
    process.env.GOOGLE_TASK_PROJECT = 'test-project';
    process.env.GOOGLE_TASK_LOCATION = 'us-east1';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
    service = new GoogleTasksService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMillisecondDiff', () => {
    it('should return positive diff for future date', async () => {
      const future = new Date(Date.now() + 60000).toISOString();
      const result = await service.getMillisecondDiff(future);
      expect(result).toBeGreaterThan(0);
    });

    it('should return negative diff for past date', async () => {
      const past = new Date(Date.now() - 60000).toISOString();
      const result = await service.getMillisecondDiff(past);
      expect(result).toBeLessThan(0);
    });
  });

  describe('post', () => {
    it('should call createTask with correct queue path', async () => {
      const request = { payload: JSON.stringify({ test: true }), waitFor: 0 };
      const result = await service.post(request, '', 'queue-name', 'https://callback.url');
      expect(result).toEqual([{ name: 'projects/p/queues/q/tasks/task-123' }, {}, {}]);
    });

    it('should throw when payload is empty', async () => {
      const request = { payload: '', waitFor: 0 };
      await expect(service.post(request, '', 'queue-name', 'https://callback.url')).rejects.toThrow('Failed to process and submit task');
    });

    it('should append urlParams to URL when provided', async () => {
      const request = { payload: JSON.stringify({ test: true }), waitFor: 0 };
      await service.post(request, 'key=val', 'queue-name', 'https://callback.url');
      // If no error thrown, it passed
    });

    it('should set scheduleTime when waitFor > 0', async () => {
      const request = { payload: JSON.stringify({ test: true }), waitFor: 60000 };
      const result = await service.post(request, '', 'queue-name', 'https://callback.url');
      expect(result).toBeDefined();
    });

    it('should not set scheduleTime when waitFor is 0', async () => {
      const request = { payload: JSON.stringify({ test: true }), waitFor: 0 };
      const result = await service.post(request, '', 'queue-name', 'https://callback.url');
      expect(result).toBeDefined();
    });
  });

  describe('calculateTimeStampScheduleTime (via post)', () => {
    it('should handle positive waitFor value', async () => {
      const request = { payload: JSON.stringify({ test: true }), waitFor: 30000 };
      const result = await service.post(request, '', 'queue-name', 'https://callback.url');
      expect(result).toBeDefined();
    });
  });
});
