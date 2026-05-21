import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { SchedulerJobNotFoundError, SchedulerService } from './scheduler.service';
import { QUEUE_BMS_USAGE, QUEUE_CAMPAIGN_TESTAB, QUEUE_CAMPAIGN_TRIGGER, QUEUE_SEGMENT, QUEUE_WHATSAPP_MESSAGE } from './queue.constants';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let triggerQueue: { add: jest.Mock; getJob: jest.Mock };
  let testabQueue: { add: jest.Mock; getJob: jest.Mock };
  let segmentQueue: { add: jest.Mock; getJob: jest.Mock };
  let usageQueue: { add: jest.Mock; getJob: jest.Mock };
  let whatsappQueue: { add: jest.Mock; getJob: jest.Mock };

  const buildQueueMock = () => ({ add: jest.fn().mockResolvedValue(undefined), getJob: jest.fn().mockResolvedValue(null) });

  beforeEach(async () => {
    triggerQueue = buildQueueMock();
    testabQueue = buildQueueMock();
    segmentQueue = buildQueueMock();
    usageQueue = buildQueueMock();
    whatsappQueue = buildQueueMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getQueueToken(QUEUE_CAMPAIGN_TRIGGER), useValue: triggerQueue },
        { provide: getQueueToken(QUEUE_CAMPAIGN_TESTAB), useValue: testabQueue },
        { provide: getQueueToken(QUEUE_SEGMENT), useValue: segmentQueue },
        { provide: getQueueToken(QUEUE_BMS_USAGE), useValue: usageQueue },
        { provide: getQueueToken(QUEUE_WHATSAPP_MESSAGE), useValue: whatsappQueue },
      ],
    }).compile();

    service = module.get(SchedulerService);
  });

  describe('create', () => {
    it('routes to campaign-trigger queue by default', async () => {
      await service.create(123, new Date(Date.now() + 60_000), 'http://hub/campaign', 'bms-scheduler-campaign-trigger');
      expect(triggerQueue.add).toHaveBeenCalled();
      expect(testabQueue.add).not.toHaveBeenCalled();
    });

    it('routes to testab queue', async () => {
      await service.create(7, new Date(Date.now() + 5_000), 'http://hub/x', 'bms-scheduler-campaign-testab');
      expect(testabQueue.add).toHaveBeenCalled();
      expect(triggerQueue.add).not.toHaveBeenCalled();
    });

    it('routes segment to segment queue', async () => {
      await service.create(9, new Date(), 'http://hub/seg', 'bms-scheduler-segment');
      expect(segmentQueue.add).toHaveBeenCalled();
    });

    it('routes whatsapp message to whatsapp queue', async () => {
      await service.create('abc/1', new Date(), 'http://hub/m', 'bms-scheduler-whatsapp-message');
      expect(whatsappQueue.add).toHaveBeenCalled();
    });

    it('replaces empty-string id with anon-* segment so jobName is unique', async () => {
      await service.create('', new Date(), 'http://hub/x', 'bms-scheduler-bms-usage');
      const [jobName] = usageQueue.add.mock.calls[0];
      expect(jobName).toMatch(/^bms-scheduler-bms-usage:anon-[0-9a-f]{8}:[0-9a-f]{12}$/);
    });

    it('clamps past scheduleTo to delay 0', async () => {
      const past = new Date(Date.now() - 10_000);
      await service.create(1, past, 'http://hub/x', 'bms-scheduler-campaign-trigger');
      const [, , opts] = triggerQueue.add.mock.calls[0];
      expect(opts.delay).toBe(0);
    });

    it('returns the job name in the legacy [{ name }] shape', async () => {
      const result = await service.create(42, new Date(Date.now() + 1000), 'http://hub/x', 'bms-scheduler-campaign-trigger');
      expect(result).toHaveLength(1);
      expect(result[0].name).toMatch(/^bms-scheduler-campaign-trigger:42:[0-9a-f]{12}$/);
    });
  });

  describe('delete', () => {
    it('returns false silently when the job is not found in any queue', async () => {
      const result = await service.delete('missing', 'bms-scheduler-campaign-trigger');
      expect(result).toBe(false);
    });

    it('removes the job and returns true when found in the resolved queue', async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      triggerQueue.getJob.mockResolvedValue({ remove });
      const result = await service.delete('foo', 'bms-scheduler-campaign-trigger');
      expect(remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('falls back to scanning other queues when not found in resolved queue (env rename safety)', async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      triggerQueue.getJob.mockResolvedValue(null);
      testabQueue.getJob.mockResolvedValue({ remove });
      const result = await service.delete('foo', 'bms-scheduler-campaign-trigger');
      expect(remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('callRunTask', () => {
    it('throws SchedulerJobNotFoundError when the job is gone (legacy NOT_FOUND contract)', async () => {
      await expect(service.callRunTask('gone', 'bms-scheduler-bms-usage')).rejects.toBeInstanceOf(SchedulerJobNotFoundError);
    });

    it('promotes the job and returns true when found in delayed state', async () => {
      const promote = jest.fn().mockResolvedValue(undefined);
      usageQueue.getJob.mockResolvedValue({ promote, getState: jest.fn().mockResolvedValue('delayed') });
      const result = await service.callRunTask('here', 'bms-scheduler-bms-usage');
      expect(promote).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('throws SchedulerJobNotFoundError when the job exists but already finished (EVO-1428)', async () => {
      const promote = jest.fn();
      usageQueue.getJob.mockResolvedValue({ promote, getState: jest.fn().mockResolvedValue('completed') });
      await expect(service.callRunTask('done', 'bms-scheduler-bms-usage')).rejects.toBeInstanceOf(SchedulerJobNotFoundError);
      expect(promote).not.toHaveBeenCalled();
    });

    it('returns true without promoting when the job is already queued to run', async () => {
      const promote = jest.fn();
      usageQueue.getJob.mockResolvedValue({ promote, getState: jest.fn().mockResolvedValue('active') });
      const result = await service.callRunTask('running', 'bms-scheduler-bms-usage');
      expect(result).toBe(true);
      expect(promote).not.toHaveBeenCalled();
    });
  });
});
