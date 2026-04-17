import { Test, TestingModule } from '@nestjs/testing';
import { ConditionStep } from './condition.step';
import { PubSubProvider } from '../providers/pubsub.provider';
import { GoogleTasksService } from '../google-tasks.service';
import { TrackerService } from '../tracker/tracker.service';
import { LeadStateMessage, Next, StepType, CompressedPayload } from '../interfaces';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('Steps: ConditionStep', () => {
  let conditionStep: ConditionStep;
  let pubSubProvider: jest.Mocked<PubSubProvider>;
  let googleTasksService: jest.Mocked<GoogleTasksService>;
  let trackerService: jest.Mocked<TrackerService>;

  beforeEach(async () => {
    const mockPubSubProvider = {
      sendAsyncMessage: jest.fn().mockResolvedValue('message-id-123'),
    };

    const mockGoogleTasksService = {
      post: jest.fn().mockResolvedValue([
        {
          name: 'projects/test/locations/us-east1/queues/test/tasks/task-123',
          scheduleTime: {
            seconds: 1234567890,
          },
        },
      ]),
    };

    const mockTrackerService = {
      send: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionStep,
        { provide: PubSubProvider, useValue: mockPubSubProvider },
        { provide: GoogleTasksService, useValue: mockGoogleTasksService },
        { provide: TrackerService, useValue: mockTrackerService },
      ],
    }).compile();

    conditionStep = module.get<ConditionStep>(ConditionStep);
    pubSubProvider = module.get(PubSubProvider);
    googleTasksService = module.get(GoogleTasksService);
    trackerService = module.get(TrackerService);
  });

  describe('processConditionalTime', () => {
    let mockLeadStateMessage: LeadStateMessage;
    let mockNext: Next;
    let mockStep: any;
    let mockCompressPayload: CompressedPayload;

    beforeEach(() => {
      mockLeadStateMessage = {
        id: 'lead-123',
        automation: {
          id: 100,
          type: 'email',
          title: 'Test Automation',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '50',
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        account: {
          id: 1,
          customFields: [],
          accountConfigs: {
            time_zone: 'America/Sao_Paulo',
          },
        },
      };

      mockNext = {
        pubName: 'msgops.message.trigger',
        data: { ...mockLeadStateMessage },
      };

      mockStep = {
        id: 50,
        type: StepType.CONDITIONAL_TIME,
        settings: {
          initialTime: 8,
          endTime: 21,
        },
      };

      mockCompressPayload = {
        automationKey: 'automation-100-123-1234567890',
        contactId: 123,
        automationId: 100,
        stepId: 50,
      };
    });

    it('should process next step immediately when current time is within range', async () => {
      // Arrange
      const currentHour = 14; // 14h - dentro do range 8-21
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      const result = await conditionStep.processConditionalTime('message-id-1', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(result).toBe('message-id-123');
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(mockNext.pubName, mockNext.data, mockCompressPayload);
      expect(googleTasksService.post).not.toHaveBeenCalled();
    });

    it('should create Google Task when current time is before initialTime', async () => {
      // Arrange
      const currentHour = 6; // 6h - antes do range 8-21
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      const result = await conditionStep.processConditionalTime('message-id-2', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(result).toBe('task-123');
      expect(googleTasksService.post).toHaveBeenCalled();
      expect(pubSubProvider.sendAsyncMessage).not.toHaveBeenCalled();

      const [taskBody, , stepType] = googleTasksService.post.mock.calls[0];
      expect(taskBody.waitFor).toBeGreaterThan(0);
      expect(stepType).toBe(StepType.CONDITIONAL_TIME);
    });

    it('should create Google Task when current time is after endTime', async () => {
      // Arrange
      const currentHour = 23; // 23h - depois do range 8-21

      // Create a chainable mock for dayjs methods
      const createDayjsMock = (hour: number) => {
        const mock: any = {
          hour: jest.fn((h?: number) => {
            if (h !== undefined) {
              return createDayjsMock(h);
            }
            return hour;
          }),
          add: jest.fn(() => createDayjsMock(8)), // Returns a dayjs with hour 8 (next day at initialTime)
          diff: jest.fn(() => 9), // 9 hours difference
          tz: jest.fn(() => mock),
        };
        return mock;
      };

      const dayjsMock = createDayjsMock(currentHour);
      jest.spyOn(dayjs.prototype, 'hour').mockImplementation(dayjsMock.hour);
      jest.spyOn(dayjs.prototype, 'add').mockImplementation(dayjsMock.add);
      jest.spyOn(dayjs.prototype, 'tz').mockImplementation(dayjsMock.tz);

      // Act
      const result = await conditionStep.processConditionalTime('message-id-3', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(result).toBe('task-123');
      expect(googleTasksService.post).toHaveBeenCalled();
      expect(pubSubProvider.sendAsyncMessage).not.toHaveBeenCalled();

      // Cleanup mocks
      jest.restoreAllMocks();
    });

    it('should use default timezone America/Sao_Paulo when accountConfigs is not provided', async () => {
      // Arrange
      const mockLeadStateWithoutTimezone: LeadStateMessage = {
        ...mockLeadStateMessage,
        account: undefined,
      };
      const currentHour = 10;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-4', mockLeadStateWithoutTimezone, mockNext, mockStep, mockCompressPayload);

      // Assert
      // Should not throw error and use default timezone
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalled();
    });

    it('should send tracker event when creating Google Task', async () => {
      // Arrange
      const currentHour = 5; // Before initialTime
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-5', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(trackerService.send).toHaveBeenCalledWith(
        'MSGOPS_CREATED_CLOUD_TASK',
        expect.objectContaining({
          automation_name: 'Test Automation',
          automation_type: 'email',
          email: 'test@example.com',
          active_step: '50',
          active_step_type: StepType.CONDITIONAL_TIME,
          message_id: 'message-id-5',
          cloud_task_id: 'task-123',
          cloud_task_schedule_time: '1234567890',
        }),
        mockLeadStateMessage.startedAt,
      );
    });

    it('should process immediately when initialTime equals endTime and current hour matches', async () => {
      // Arrange
      mockStep.settings.initialTime = 10;
      mockStep.settings.endTime = 10;
      const currentHour = 10;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-6', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalled();
      expect(googleTasksService.post).not.toHaveBeenCalled();
    });

    it('should handle edge case at exact initialTime', async () => {
      // Arrange
      const currentHour = 8; // Exactly at initialTime
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-7', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalled();
      expect(googleTasksService.post).not.toHaveBeenCalled();
    });

    it('should handle edge case at exact endTime', async () => {
      // Arrange
      const currentHour = 21; // Exactly at endTime
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-8', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalled();
      expect(googleTasksService.post).not.toHaveBeenCalled();
    });

    it('should serialize leadStateMessage correctly in task payload', async () => {
      // Arrange
      const currentHour = 5;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-9', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      const [taskBody] = googleTasksService.post.mock.calls[0];
      expect(taskBody.payload).toBeDefined();

      const parsedPayload = JSON.parse(taskBody.payload);
      expect(parsedPayload).toEqual(mockNext.data);
    });

    it('should calculate waitFor correctly when before initialTime', async () => {
      // Arrange
      mockStep.settings.initialTime = 9;
      const currentHour = 7; // 2 hours before
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-10', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      const [taskBody] = googleTasksService.post.mock.calls[0];
      expect(taskBody.waitFor).toBe(120); // 2 hours * 60 minutes
    });

    it('should pass correct urlParams to Google Tasks', async () => {
      // Arrange
      const currentHour = 5;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-11', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      const [, urlParams] = googleTasksService.post.mock.calls[0];
      expect(urlParams).toContain('automation_name=Test Automation');
      expect(urlParams).toContain('active_step=50');
      expect(urlParams).toContain('email=test@example.com');
      expect(urlParams).toContain(`start_date=${mockLeadStateMessage.startedAt}`);
    });

    it('should handle different timezones correctly', async () => {
      // Arrange
      mockLeadStateMessage.account.accountConfigs.time_zone = 'America/New_York';
      const currentHour = 12;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      // Act
      await conditionStep.processConditionalTime('message-id-12', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      // Should use the specified timezone
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalled();
    });
  });

  describe('private methods indirectly tested through processConditionalTime', () => {
    it('should call processNextStep when conditions are met', async () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-test',
        automation: {
          id: 200,
          type: 'email',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '100',
        contact: {
          email: 'test@example.com',
        },
        account: {
          id: 1,
          customFields: [],
          accountConfigs: {
            time_zone: 'UTC',
          },
        },
      };

      const mockNext: Next = {
        pubName: 'test-topic',
        data: mockLeadStateMessage,
      };

      const mockStep = {
        id: 100,
        type: StepType.CONDITIONAL_TIME,
        settings: {
          initialTime: 0,
          endTime: 23,
        },
      };

      const mockCompressPayload: CompressedPayload = {
        automationKey: 'test-key',
        contactId: 456,
        automationId: 200,
        stepId: 100,
      };

      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(12);

      // Act
      await conditionStep.processConditionalTime('test-message', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      // Assert
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith('test-topic', mockLeadStateMessage, mockCompressPayload);
    });
  });
});
