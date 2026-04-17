const mockCreateTask = jest.fn();
const mockDeleteTask = jest.fn();
const mockQueuePath = jest.fn().mockReturnValue('projects/p/locations/l/queues/q');

jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    createTask: mockCreateTask,
    deleteTask: mockDeleteTask,
    queuePath: mockQueuePath,
  })),
  protos: {
    google: {
      protobuf: {
        Duration: {
          create: jest.fn().mockReturnValue({ seconds: 1800 }),
        },
      },
    },
  },
}));

import { GoogleTasksProvider } from './google-tasks.provider';

describe('GoogleTasksProvider', () => {
  let provider: GoogleTasksProvider;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GOOGLE_TASKS_PROJECT_ID = 'test-project';
    process.env.GOOGLE_TASKS_LOCATION = 'us-east1';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
    mockCreateTask.mockReset();
    mockDeleteTask.mockReset();
    provider = new GoogleTasksProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('create', () => {
    it('should return random name in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const result = await provider.create(1, '2025-01-01 10:00:00', 'https://example.com', 'test-queue');
      expect(result[0].name).toBeDefined();
      expect(typeof result[0].name).toBe('string');
    });

    it('should create task in production', async () => {
      process.env.NODE_ENV = 'production';
      mockCreateTask.mockResolvedValue([{ name: 'task-123' }]);

      await provider.create(1, '2099-01-01 10:00:00', 'https://example.com', 'test-queue');

      expect(mockCreateTask).toHaveBeenCalled();
    });

    it('should create task with body in production', async () => {
      process.env.NODE_ENV = 'production';
      mockCreateTask.mockResolvedValue([{ name: 'task-123' }]);

      await provider.create(1, '2099-01-01 10:00:00', 'https://example.com', 'test-queue', '{"key":"value"}');

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              headers: { 'Content-Type': 'application/json' },
            }),
          }),
        }),
      );
    });

    it('should throw when createTask fails in production', async () => {
      process.env.NODE_ENV = 'production';
      // The error is caught inside createTaskRequest or create and re-thrown
      mockCreateTask.mockImplementation(() => {
        throw new Error('task creation failed');
      });

      await expect(provider.create(1, '2099-01-01 10:00:00', 'https://example.com', 'test-queue')).rejects.toThrow(
        'Failed to process',
      );
    });
  });

  describe('delete', () => {
    it('should delete task by name', async () => {
      mockDeleteTask.mockResolvedValue(undefined);

      await provider.delete('task-name', 'test-queue');

      expect(mockDeleteTask).toHaveBeenCalledWith({ name: 'task-name' });
    });
  });

  describe('createTaskRequest (via create)', () => {
    it('should throw when id is 0 in production', async () => {
      process.env.NODE_ENV = 'production';

      await expect(provider.create(0, '2099-01-01 10:00:00', 'https://example.com', 'test-queue')).rejects.toThrow(
        'ID should be informed',
      );
    });
  });
});
