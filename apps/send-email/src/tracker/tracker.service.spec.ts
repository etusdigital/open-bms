import { TrackerService } from './tracker.service';
import { MsgopsEvent } from './tracker.interface';
import { createTrackerRequest } from '../__mocks__/test-fixtures';

describe('TrackerService', () => {
  let service: TrackerService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.LOG_LEVEL = 'INFO';
    process.env.CLOUD_RUN = 'test-run';
    process.env.PORT = '3000';
    process.env.K_REVISION = 'rev-1';
    process.env.K_CONFIGURATION = 'config-1';

    service = new TrackerService();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.LOG_LEVEL;
    delete process.env.CLOUD_RUN;
    delete process.env.PORT;
    delete process.env.K_REVISION;
    delete process.env.K_CONFIGURATION;
  });

  describe('constructor', () => {
    it('should set logLevel from environment variable', () => {
      expect(service.logLevel).toBe('INFO');
    });

    it('should default to INFO when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;
      const svc = new TrackerService();
      expect(svc.logLevel).toBe('INFO');
    });
  });

  describe('getParameters', () => {
    it('should return parameters with cloud run environment info', () => {
      const params = createTrackerRequest();
      const startedAt = 1700000000000;

      const result = service.getParameters(MsgopsEvent.MSGOPS_SEND_EMAIL, params, startedAt);

      expect(result.cloud_run).toBe('test-run');
      expect(result.PORT).toBe('3000');
      expect(result.k_revision).toBe('rev-1');
      expect(result.k_configuration).toBe('config-1');
      expect(result.started_at).toBe(startedAt);
      expect(result.event).toBe(MsgopsEvent.MSGOPS_SEND_EMAIL);
      expect(result.event_time).toBeDefined();
      expect(typeof result.event_time).toBe('number');
    });

    it('should spread input params into the result', () => {
      const params = createTrackerRequest({ email: 'custom@test.com', message_id: 'msg-999' });

      const result = service.getParameters(MsgopsEvent.MSGOPS_SENDGRID_RESPONSE, params, Date.now());

      expect(result.email).toBe('custom@test.com');
      expect(result.message_id).toBe('msg-999');
    });

    it('should default to local when env vars are not set', () => {
      delete process.env.CLOUD_RUN;
      delete process.env.PORT;
      delete process.env.K_REVISION;
      delete process.env.K_CONFIGURATION;

      const svc = new TrackerService();
      const result = svc.getParameters(MsgopsEvent.MSGOPS_SEND_EMAIL, createTrackerRequest(), Date.now());

      expect(result.cloud_run).toBe('local');
      expect(result.PORT).toBe('local');
      expect(result.k_revision).toBe('local');
      expect(result.k_configuration).toBe('local');
    });
  });

  describe('getKey', () => {
    it('should compose key from email, automationName, and startedAt', () => {
      const key = service.getKey('user@test.com', 'welcome-flow', 1700000000000);
      expect(key).toBe('user@test.com:welcome-flow:1700000000000');
    });

    it('should handle empty strings', () => {
      const key = service.getKey('', '', 0);
      expect(key).toBe('::0');
    });
  });

  describe('logInfo', () => {
    it('should log when logLevel is INFO', () => {
      service.logLevel = 'INFO';
      service.logInfo('test message', 'args');
      expect(consoleSpy).toHaveBeenCalledWith('test message', 'args');
    });

    it('should log when logLevel is DEBUG', () => {
      service.logLevel = 'DEBUG';
      service.logInfo('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message', '');
    });

    it('should not log when logLevel is ERROR', () => {
      service.logLevel = 'ERROR';
      service.logInfo('should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should default args to empty string when not provided', () => {
      service.logLevel = 'INFO';
      service.logInfo('message only');
      expect(consoleSpy).toHaveBeenCalledWith('message only', '');
    });
  });

  describe('logDebug', () => {
    it('should log when logLevel is DEBUG', () => {
      service.logLevel = 'DEBUG';
      service.logDebug('debug message', 'extra');
      expect(consoleSpy).toHaveBeenCalledWith('debug message', 'extra');
    });

    it('should not log when logLevel is INFO', () => {
      service.logLevel = 'INFO';
      service.logDebug('should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should not log when logLevel is ERROR', () => {
      service.logLevel = 'ERROR';
      service.logDebug('should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should always log regardless of logLevel', () => {
      service.logLevel = 'ERROR';
      service.logError('error message', 'details');
      expect(consoleSpy).toHaveBeenCalledWith('error message', 'details');
    });

    it('should default args to empty string when not provided', () => {
      service.logError('error only');
      expect(consoleSpy).toHaveBeenCalledWith('error only', '');
    });
  });

  describe('sendDebug', () => {
    it('should call send when logLevel is DEBUG', () => {
      service.logLevel = 'DEBUG';
      const params = createTrackerRequest();
      service.sendDebug(MsgopsEvent.MSGOPS_SEND_EMAIL, params, Date.now());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not call send when logLevel is INFO', () => {
      service.logLevel = 'INFO';
      service.sendDebug(MsgopsEvent.MSGOPS_SEND_EMAIL, createTrackerRequest(), Date.now());
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendInfo', () => {
    it('should call send when logLevel is INFO', () => {
      service.logLevel = 'INFO';
      service.sendInfo(MsgopsEvent.MSGOPS_SEND_EMAIL, createTrackerRequest(), Date.now());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should call send when logLevel is DEBUG', () => {
      service.logLevel = 'DEBUG';
      service.sendInfo(MsgopsEvent.MSGOPS_SEND_EMAIL, createTrackerRequest(), Date.now());
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not call send when logLevel is ERROR', () => {
      service.logLevel = 'ERROR';
      service.sendInfo(MsgopsEvent.MSGOPS_SEND_EMAIL, createTrackerRequest(), Date.now());
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should use current time as fallback when started_at is 0', () => {
      service.logLevel = 'DEBUG';
      service.sendInfo(MsgopsEvent.MSGOPS_SEND_EMAIL, createTrackerRequest(), 0);
      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleSpy.mock.calls[0][0].replace('TrackerService: ', ''));
      expect(loggedData.started_at).toBeGreaterThan(0);
    });
  });
});
