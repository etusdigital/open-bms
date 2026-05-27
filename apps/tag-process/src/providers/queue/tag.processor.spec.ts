import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { TagProcessor } from './tag.processor';
import { AppService } from '../../app.service';

describe('TagProcessor', () => {
  let processor: TagProcessor;
  let appService: jest.Mocked<AppService>;

  const mockData = {
    tagName: 'test-tag',
    id: 'lead-123',
    contact: { id: 1, uuid: 'uuid-1', email: 'test@example.com' },
    automation: { id: 50, name: 'Test Automation' },
    account: { id: 1, accountConfigs: {} },
    startedAt: Date.now(),
    leadId: 1,
    isLeadFromAnotherAutomation: true,
  };

  const makeJob = (type: string) => ({ data: { ...mockData, type } }) as unknown as Job;

  beforeEach(async () => {
    const mockAppService = {
      addTag: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      removeTag: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      processCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagProcessor, { provide: AppService, useValue: mockAppService }],
    }).compile();

    processor = module.get<TagProcessor>(TagProcessor);
    appService = module.get(AppService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should call appService.addTag for type=add', async () => {
    await processor.process(makeJob('add'));
    expect(appService.addTag).toHaveBeenCalledWith(expect.objectContaining({ type: 'add', tagName: 'test-tag' }));
    expect(appService.removeTag).not.toHaveBeenCalled();
    expect(appService.processCompleted).not.toHaveBeenCalled();
  });

  it('should call appService.removeTag for type=remove', async () => {
    await processor.process(makeJob('remove'));
    expect(appService.removeTag).toHaveBeenCalledWith(expect.objectContaining({ type: 'remove', tagName: 'test-tag' }));
    expect(appService.addTag).not.toHaveBeenCalled();
  });

  it('should call appService.processCompleted for type=completed', async () => {
    await processor.process(makeJob('completed'));
    expect(appService.processCompleted).toHaveBeenCalledWith(expect.objectContaining({ type: 'completed' }));
    expect(appService.addTag).not.toHaveBeenCalled();
    expect(appService.removeTag).not.toHaveBeenCalled();
  });

  it('should throw for unknown type so BullMQ retries / DLQs the job', async () => {
    await expect(processor.process(makeJob('unknown'))).rejects.toThrow(/Unknown tag-process job type/);
    expect(appService.addTag).not.toHaveBeenCalled();
    expect(appService.removeTag).not.toHaveBeenCalled();
    expect(appService.processCompleted).not.toHaveBeenCalled();
  });
});
