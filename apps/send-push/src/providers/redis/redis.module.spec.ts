import { Test } from '@nestjs/testing';
import { RedisModule } from './redis.module';
import { RedisService } from './redis.service';
import { REDIS } from './redis.provider';

describe('RedisModule', () => {
  it('should compile and export RedisService', async () => {
    const module = await Test.createTestingModule({
      imports: [RedisModule],
    })
      .overrideProvider(REDIS)
      .useValue({ connect: jest.fn(), quit: jest.fn() })
      .compile();

    const service = module.get(RedisService);
    expect(service).toBeDefined();
    expect(service.getClient()).toBeDefined();
  });
});
