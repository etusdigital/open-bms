const mockWrite = jest.fn().mockResolvedValue(undefined);
const mockEntry = jest.fn().mockReturnValue({});
const mockLog = jest.fn().mockReturnValue({ entry: mockEntry, write: mockWrite });

jest.mock('@google-cloud/logging', () => ({
  Logging: jest.fn().mockImplementation(() => ({
    log: mockLog,
  })),
}));

import { LoggingProvider } from './logging.provider';

describe('LoggingProvider', () => {
  let provider: LoggingProvider;

  beforeEach(() => {
    process.env.GCP_PROJECT = 'test-project';
    mockWrite.mockClear();
    mockEntry.mockClear();
    mockLog.mockClear();
    provider = new LoggingProvider();
  });

  describe('createLogging', () => {
    it('should write a log entry', async () => {
      await provider.createLogging('["test@test.com"]');

      expect(mockLog).toHaveBeenCalledWith('Tag-Process');
      expect(mockEntry).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'WARNING' }),
        expect.stringContaining('Contacts not found'),
      );
      expect(mockWrite).toHaveBeenCalled();
    });

    it('should include the emails in the log text', async () => {
      await provider.createLogging('["a@test.com","b@test.com"]');

      expect(mockEntry).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('a@test.com'));
    });

    it('should use GCP_PROJECT from env', async () => {
      process.env.GCP_PROJECT = 'my-project';
      await provider.createLogging('[]');

      const { Logging } = require('@google-cloud/logging');
      expect(Logging).toHaveBeenCalledWith({ projectId: 'my-project' });
    });
  });
});
