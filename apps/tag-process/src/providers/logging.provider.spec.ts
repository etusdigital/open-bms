const mockWarn = jest.fn();
const mockLogger = { warn: mockWarn };
const mockFactory = jest.fn(() => mockLogger);

jest.mock('pino', () => {
  const fn: any = mockFactory;
  fn.default = mockFactory;
  fn.__esModule = true;
  return fn;
});

import { LoggingProvider } from './logging.provider';

describe('LoggingProvider', () => {
  let provider: LoggingProvider;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    delete process.env.LOG_LEVEL;
    mockWarn.mockClear();
    mockFactory.mockClear();
    provider = new LoggingProvider();
  });

  afterAll(() => {
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  describe('createLogging', () => {
    it('should emit a warn-level structured log', async () => {
      await provider.createLogging('["test@test.com"]');

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ emails: '["test@test.com"]' }),
        expect.stringContaining('contacts not found'),
      );
    });

    it('should include the emails payload verbatim', async () => {
      await provider.createLogging('["a@test.com","b@test.com"]');

      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ emails: '["a@test.com","b@test.com"]' }),
        expect.any(String),
      );
    });

    it('should accept empty array payload', async () => {
      await provider.createLogging('[]');

      expect(mockWarn).toHaveBeenCalledWith(expect.objectContaining({ emails: '[]' }), expect.any(String));
    });
  });

  describe('constructor', () => {
    it('should default the logger level to "info" when LOG_LEVEL is unset', () => {
      delete process.env.LOG_LEVEL;
      mockFactory.mockClear();

      new LoggingProvider();

      expect(mockFactory).toHaveBeenCalledWith(expect.objectContaining({ level: 'info' }));
    });

    it('should normalize LOG_LEVEL to lowercase when present', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      mockFactory.mockClear();

      new LoggingProvider();

      expect(mockFactory).toHaveBeenCalledWith(expect.objectContaining({ level: 'debug' }));
    });
  });
});
