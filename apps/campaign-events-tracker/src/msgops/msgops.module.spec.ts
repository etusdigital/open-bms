import { Test, TestingModule } from '@nestjs/testing';
import { MsgopsModule } from './msgops.module';
import { MsgopsService } from './msgops.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { ContactEntity } from './entities/contact.entity';
import { GoogleTasksProvider } from '../providers/google-tasks.provider';
import { REDIS } from '../providers/redis/redis.provider';

describe('MsgopsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    process.env.SERVICE_ACCOUNT = '{}';
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
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide MsgopsService', () => {
    const service = module.get<MsgopsService>(MsgopsService);
    expect(service).toBeDefined();
  });

  it('should provide GoogleTasksProvider', () => {
    const provider = module.get<GoogleTasksProvider>(GoogleTasksProvider);
    expect(provider).toBeDefined();
  });
});
