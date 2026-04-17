import { TrackerService } from './tracker.service';
import { MsgopsEvent } from './tracker.interface';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('TrackerService', () => {
  let service: TrackerService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(() => {
    httpService = {
      get: jest.fn().mockReturnValue(of({ data: 'ok' })),
    } as any;
    process.env.LOG_LEVEL = 'INFO';
    service = new TrackerService(httpService);
  });

  describe('getParameters', () => {
    it('should return formatted parameters with env values', () => {
      const params = service.getParameters(
        MsgopsEvent.MSGOPS_LEAD_ENTRY,
        { email: 'test@test.com', workflow_name: 'test-wf', workflow_type: 'email' },
        1000,
      );

      expect(params.event).toBe(MsgopsEvent.MSGOPS_LEAD_ENTRY);
      expect(params.email).toBe('test@test.com');
      expect(params.started_at).toBe(1000);
      expect(params.event_time).toBeDefined();
      expect(params.cloud_run).toBeDefined();
    });

    it('should use local defaults when env vars are not set', () => {
      delete process.env.CLOUD_RUN;
      delete process.env.PORT;
      delete process.env.K_REVISION;
      delete process.env.K_CONFIGURATION;

      const params = service.getParameters(
        MsgopsEvent.MSGOPS_SEND_EMAIL,
        { email: 'a@b.com', workflow_name: 'wf', workflow_type: 'email' },
        2000,
      );

      expect(params.cloud_run).toBe('local');
      expect(params.PORT).toBe('local');
      expect(params.k_revision).toBe('local');
      expect(params.k_configuration).toBe('local');
    });
  });

  describe('getKey', () => {
    it('should return email:workflowname:startedAt format', () => {
      const key = service.getKey('test@test.com', 'my-workflow', 12345);
      expect(key).toBe('test@test.com:my-workflow:12345');
    });
  });

  describe('send', () => {
    it('should log formatted tracker info', () => {
      const logSpy = jest.spyOn(service, 'logInfo');
      service.send(
        MsgopsEvent.MSGOPS_LEAD_ENTRY,
        { email: 'test@test.com', workflow_name: 'wf', workflow_type: 'email' },
        1000,
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('TrackerService'));
    });

    it('should use current time when started_at is 0', () => {
      const logSpy = jest.spyOn(service, 'logInfo');
      service.send(
        MsgopsEvent.MSGOPS_LEAD_ENTRY,
        { email: 'test@test.com', workflow_name: 'wf', workflow_type: 'email' },
        0,
      );
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('sendPixel', () => {
    it('should make HTTP GET request with pixel URL', () => {
      const trackerParams = {
        event: MsgopsEvent.MSGOPS_SEND_EMAIL,
        event_time: Date.now(),
        email: 'test@test.com',
        workflow_name: 'wf',
        workflow_type: 'email',
        started_at: 1000,
        cloud_run: 'local',
        PORT: 'local',
        k_revision: 'local',
        k_configuration: 'local',
      };

      service.sendPixel('publisher', 'key123', trackerParams);

      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('publisher'));
    });

    it('should handle HTTP error gracefully', () => {
      jest.spyOn(console, 'error').mockImplementation();
      httpService.get.mockReturnValue(throwError(() => new Error('http error')));

      // Should not throw
      expect(() => {
        service.sendPixel('publisher', 'key123', {
          event: MsgopsEvent.MSGOPS_SEND_EMAIL,
          event_time: Date.now(),
          email: 'a@b.com',
          workflow_name: 'wf',
          workflow_type: 'email',
          started_at: 1000,
          cloud_run: 'local',
          PORT: 'local',
          k_revision: 'local',
          k_configuration: 'local',
        });
      }).not.toThrow();
    });
  });

  describe('getPixel', () => {
    it('should build pixel URL with all parameters', () => {
      const params = {
        event: MsgopsEvent.MSGOPS_SEND_EMAIL,
        event_time: 123456,
        email: 'test@test.com',
        workflow_name: 'wf',
        workflow_type: 'email',
        started_at: 1000,
        cloud_run: 'local',
        PORT: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        active_step: 'step1',
        active_step_type: 'email',
        sengrid_response: 'ok',
        email_file: 'file.html',
        utm_campaign: 'campaign1',
        message_id: '123',
        list_id: '456',
        cloud_task_id: 'task1',
        cloud_task_schedule_time: '2024-01-01',
      };

      const url = service.getPixel('pub', 'key1', params, 'https://example.com?');

      expect(url).toContain('publisher=pub');
      expect(url).toContain('tracker_key=key1');
      expect(url).toContain('email=test@test.com');
      expect(url).toContain('active_step=step1');
      expect(url).toContain('message_id=123');
    });
  });

  describe('logInfo', () => {
    it('should log when LOG_LEVEL is INFO', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      service.logLevel = 'INFO';
      service.logInfo('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message', '');
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      service.logLevel = 'DEBUG';
      service.logInfo('test message', 'extra');
      expect(consoleSpy).toHaveBeenCalledWith('test message', 'extra');
    });

    it('should not log when LOG_LEVEL is ERROR', () => {
      // Clear any previous spies
      jest.restoreAllMocks();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      service.logLevel = 'ERROR';
      service.logInfo('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
