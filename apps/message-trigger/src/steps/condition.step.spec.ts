import { Test, TestingModule } from '@nestjs/testing';
import { ConditionStep } from './condition.step';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { TrackerService } from '../tracker/tracker.service';
import { LeadStateMessage, Next, StepType, CompressedPayload } from '../interfaces';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('Steps: ConditionStep', () => {
  let conditionStep: ConditionStep;
  let queuePublisher: jest.Mocked<QueuePublisher>;
  let trackerService: jest.Mocked<TrackerService>;

  beforeEach(async () => {
    const mockQueuePublisher = {
      sendAsyncMessage: jest.fn().mockResolvedValue('job-id-123'),
      scheduleDelayedStep: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const mockTrackerService = {
      send: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConditionStep, { provide: QueuePublisher, useValue: mockQueuePublisher }, { provide: TrackerService, useValue: mockTrackerService }],
    }).compile();

    conditionStep = module.get<ConditionStep>(ConditionStep);
    queuePublisher = module.get(QueuePublisher);
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
        pubName: 'message-trigger',
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
      const currentHour = 14;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      const result = await conditionStep.processConditionalTime('message-id-1', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(result).toBe('job-id-123');
      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalledWith(mockNext.pubName, mockNext.data, mockCompressPayload);
      expect(queuePublisher.scheduleDelayedStep).not.toHaveBeenCalled();
    });

    it('should schedule delayed step when current time is before initialTime', async () => {
      const currentHour = 6;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      const result = await conditionStep.processConditionalTime('message-id-2', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(result).toBe('job-123');
      expect(queuePublisher.scheduleDelayedStep).toHaveBeenCalled();
      expect(queuePublisher.sendAsyncMessage).not.toHaveBeenCalled();

      const [data, waitFor, stepType] = queuePublisher.scheduleDelayedStep.mock.calls[0];
      expect(waitFor).toBeGreaterThan(0);
      expect(stepType).toBe(StepType.CONDITIONAL_TIME);
      expect(data).toEqual(mockNext.data);
    });

    it('should schedule delayed step when current time is after endTime', async () => {
      const currentHour = 23;

      const createDayjsMock = (hour: number) => {
        const mock: any = {
          hour: jest.fn((h?: number) => (h !== undefined ? createDayjsMock(h) : hour)),
          add: jest.fn(() => createDayjsMock(8)),
          diff: jest.fn(() => 9),
          tz: jest.fn(() => mock),
        };
        return mock;
      };

      const dayjsMock = createDayjsMock(currentHour);
      jest.spyOn(dayjs.prototype, 'hour').mockImplementation(dayjsMock.hour);
      jest.spyOn(dayjs.prototype, 'add').mockImplementation(dayjsMock.add);
      jest.spyOn(dayjs.prototype, 'tz').mockImplementation(dayjsMock.tz);

      const result = await conditionStep.processConditionalTime('message-id-3', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(result).toBe('job-123');
      expect(queuePublisher.scheduleDelayedStep).toHaveBeenCalled();
      expect(queuePublisher.sendAsyncMessage).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should use default timezone America/Sao_Paulo when accountConfigs is not provided', async () => {
      const mockLeadStateWithoutTimezone: LeadStateMessage = {
        ...mockLeadStateMessage,
        account: undefined,
      };
      const currentHour = 10;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-4', mockLeadStateWithoutTimezone, mockNext, mockStep, mockCompressPayload);

      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalled();
    });

    it('should send tracker event when scheduling delayed step', async () => {
      const currentHour = 5;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-5', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(trackerService.send).toHaveBeenCalledWith(
        'MSGOPS_CREATED_CLOUD_TASK',
        expect.objectContaining({
          automation_name: 'Test Automation',
          automation_type: 'email',
          email: 'test@example.com',
          active_step: '50',
          active_step_type: StepType.CONDITIONAL_TIME,
          message_id: 'message-id-5',
          cloud_task_id: 'job-123',
        }),
        mockLeadStateMessage.startedAt,
      );
    });

    it('should process immediately when initialTime equals endTime and current hour matches', async () => {
      mockStep.settings.initialTime = 10;
      mockStep.settings.endTime = 10;
      const currentHour = 10;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-6', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalled();
      expect(queuePublisher.scheduleDelayedStep).not.toHaveBeenCalled();
    });

    it('should handle edge case at exact initialTime', async () => {
      const currentHour = 8;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-7', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalled();
      expect(queuePublisher.scheduleDelayedStep).not.toHaveBeenCalled();
    });

    it('should handle edge case at exact endTime', async () => {
      const currentHour = 21;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-8', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalled();
      expect(queuePublisher.scheduleDelayedStep).not.toHaveBeenCalled();
    });

    it('should calculate waitFor correctly when before initialTime', async () => {
      mockStep.settings.initialTime = 9;
      const currentHour = 7;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-10', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      const [, waitFor] = queuePublisher.scheduleDelayedStep.mock.calls[0];
      expect(waitFor).toBe(120); // 2 hours * 60 minutes
    });

    it('should pass the next step data to scheduleDelayedStep', async () => {
      const currentHour = 5;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-11', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      const [data] = queuePublisher.scheduleDelayedStep.mock.calls[0];
      expect(data).toEqual(mockNext.data);
    });

    it('should handle different timezones correctly', async () => {
      mockLeadStateMessage.account.accountConfigs.time_zone = 'America/New_York';
      const currentHour = 12;
      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(currentHour);

      await conditionStep.processConditionalTime('message-id-12', mockLeadStateMessage, mockNext, mockStep, mockCompressPayload);

      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalled();
    });
  });

  describe('private methods indirectly tested through processConditionalTime', () => {
    it('should call processNextStep when conditions are met', async () => {
      const leadMsg: LeadStateMessage = {
        id: 'lead-test',
        automation: { id: 200, type: 'email', steps: [] },
        startedAt: Date.now(),
        activeStepId: '100',
        contact: { email: 'test@example.com' },
        account: { id: 1, customFields: [], accountConfigs: { time_zone: 'UTC' } },
      };

      const next: Next = { pubName: 'test-queue', data: leadMsg };
      const step = { id: 100, type: StepType.CONDITIONAL_TIME, settings: { initialTime: 0, endTime: 23 } };
      const compress: CompressedPayload = { automationKey: 'test-key', contactId: 456, automationId: 200, stepId: 100 };

      jest.spyOn(dayjs.prototype, 'hour').mockReturnValue(12);

      await conditionStep.processConditionalTime('test-message', leadMsg, next, step, compress);

      expect(queuePublisher.sendAsyncMessage).toHaveBeenCalledWith('test-queue', leadMsg, compress);
    });
  });
});
