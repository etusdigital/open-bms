import { HttpException, HttpStatus } from '@nestjs/common';
import { TagsService } from './tags.service';
import { SchedulerJobNotFoundError } from '../../providers/queue/scheduler.service';

describe('TagsService.runSegment', () => {
  let service: TagsService;
  let tagsRepository: { findOneOrFail: jest.Mock };
  let scheduler: { callRunTask: jest.Mock; create: jest.Mock };
  let redisClient: { exists: jest.Mock };
  let redisService: { getClient: jest.Mock };
  let cls: { get: jest.Mock };

  const segment = { id: 42, scheduleCloudTaskId: 'bms-scheduler-segment:42:abc' };

  beforeEach(() => {
    tagsRepository = { findOneOrFail: jest.fn().mockResolvedValue(segment) };
    scheduler = { callRunTask: jest.fn(), create: jest.fn().mockResolvedValue([{ name: 'job' }]) };
    redisClient = { exists: jest.fn().mockResolvedValue(0) };
    redisService = { getClient: jest.fn().mockResolvedValue(redisClient) };
    cls = { get: jest.fn().mockReturnValue('acc-1') };

    service = new TagsService(
      tagsRepository as any,
      {} as any, // contactsTagsRepository
      {} as any, // httpService
      {} as any, // utilsService
      {} as any, // automationsServices
      {} as any, // campaignsServices
      {} as any, // accountService
      scheduler as any,
      redisService as any,
      cls as any,
      {} as any, // accountCacheService
    );
  });

  const statusOf = async (run: Promise<unknown>): Promise<number> => {
    try {
      await run;
      throw new Error('expected runSegment to reject');
    } catch (e) {
      if (e instanceof HttpException) return e.getStatus();
      throw e;
    }
  };

  it('throws CONFLICT when the segment is already processing', async () => {
    redisClient.exists.mockResolvedValue(1);
    expect(await statusOf(service.runSegment(42))).toBe(HttpStatus.CONFLICT);
    expect(scheduler.callRunTask).not.toHaveBeenCalled();
  });

  it('promotes the scheduled job when it is still promotable', async () => {
    scheduler.callRunTask.mockResolvedValue(true);
    const result = await service.runSegment(42);
    expect(scheduler.callRunTask).toHaveBeenCalledWith(segment.scheduleCloudTaskId, 'bms-scheduler-segment');
    expect(scheduler.create).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('enqueues a fresh immediate run instead of 500 when the scheduled job is not promotable (EVO-1428)', async () => {
    scheduler.callRunTask.mockRejectedValue(new SchedulerJobNotFoundError(segment.scheduleCloudTaskId));
    const result = await service.runSegment(42);
    expect(scheduler.create).toHaveBeenCalledWith(42, expect.any(Date), process.env.TAG_PROCESS_ENDPOINT, 'bms-scheduler-segment');
    expect(result).toBe(true);
  });

  it('returns HTTP 500 only for unexpected scheduler failures', async () => {
    scheduler.callRunTask.mockRejectedValue(new Error('redis down'));
    expect(await statusOf(service.runSegment(42))).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(scheduler.create).not.toHaveBeenCalled();
  });
});
