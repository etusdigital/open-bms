import { Test, TestingModule } from '@nestjs/testing';
import { MsgopsModule } from './msgops.module';
import { MsgopsService } from './msgops.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { ContactEntity } from './entities/contact.entity';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { REDIS } from '../providers/redis/redis.provider';

describe('MsgopsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MsgopsModule],
    })
      .overrideProvider(getRepositoryToken(CampaignEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(CampaignContactEntity))
      .useValue({})
      .overrideProvider(getRepositoryToken(ContactEntity))
      .useValue({})
      .overrideProvider(REDIS)
      .useValue({
        connect: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(QueuePublisher)
      .useValue({ addCampaignTrigger: jest.fn().mockResolvedValue('mock-job-id') })
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide MsgopsService', () => {
    const service = module.get<MsgopsService>(MsgopsService);
    expect(service).toBeDefined();
  });

  it('should provide QueuePublisher', () => {
    const publisher = module.get<QueuePublisher>(QueuePublisher);
    expect(publisher).toBeDefined();
  });
});
