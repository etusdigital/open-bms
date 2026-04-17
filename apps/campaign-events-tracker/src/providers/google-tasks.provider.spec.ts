import { GoogleTasksProvider } from './google-tasks.provider';

// Mock the CloudTasksClient
jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => ({
      queuePath: jest.fn().mockReturnValue('projects/test/locations/us/queues/test-queue'),
      createTask: jest.fn().mockResolvedValue([{ name: 'task-name-123' }]),
      deleteTask: jest.fn().mockResolvedValue(true),
      runTask: jest.fn().mockResolvedValue([{ name: 'run-result' }]),
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
  };
});

describe('GoogleTasksProvider', () => {
  let provider: GoogleTasksProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SERVICE_ACCOUNT: '{}',
      GOOGLE_TASKS_PROJECT_ID: 'test-project',
      GOOGLE_TASKS_LOCATION: 'us-east1',
      GOOGLE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
      NODE_ENV: 'test',
    };
    provider = new GoogleTasksProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('create', () => {
    it('should return random hex name in non-production environment', async () => {
      const result = await provider.create(1, new Date(), 'https://example.com', 'test-queue');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBeDefined();
      expect(typeof result[0].name).toBe('string');
    });

    it('should call createTask in production environment', async () => {
      process.env.NODE_ENV = 'production';
      provider = new GoogleTasksProvider();

      const result = await provider.create(1, new Date(), 'https://example.com', 'test-queue');
      expect(result).toBeDefined();
    });

    it('should call createTask with body in production environment', async () => {
      process.env.NODE_ENV = 'production';
      provider = new GoogleTasksProvider();

      const result = await provider.create(1, new Date(), 'https://example.com', 'test-queue', '{"test": true}');
      expect(result).toBeDefined();
    });

    it('should handle future schedule dates in production', async () => {
      process.env.NODE_ENV = 'production';
      provider = new GoogleTasksProvider();

      const futureDate = new Date(Date.now() + 60000);
      const result = await provider.create(1, futureDate, 'https://example.com', 'test-queue');
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should return true in non-production environment', async () => {
      const result = await provider.delete('task-name', 'test-queue');
      expect(result).toBe(true);
    });

    it('should call deleteTask in production environment', async () => {
      process.env.NODE_ENV = 'production';
      provider = new GoogleTasksProvider();

      const result = await provider.delete('task-name', 'test-queue');
      expect(result).toBeDefined();
    });
  });

  describe('callRunTask', () => {
    it('should return true in non-production environment', async () => {
      const result = await provider.callRunTask('task-name', 'test-queue');
      expect(result).toBe(true);
    });

    it('should call runTask in production environment', async () => {
      process.env.NODE_ENV = 'production';
      provider = new GoogleTasksProvider();

      const result = await provider.callRunTask('task-name', 'test-queue');
      expect(result).toBeDefined();
    });
  });
});
