import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Mock fs and mmdb-reader before AppModule imports AppService
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from('')),
  existsSync: jest.fn().mockReturnValue(false),
}));
jest.mock('mmdb-reader', () => {
  return function () {
    return { lookup: jest.fn() };
  };
});

describe('AppModule', () => {
  it('should compile the real AppModule with ConfigModule', async () => {
    process.env.DBIP_MMDB_PATH = './test.mmdb';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should provide AppController', async () => {
    process.env.DBIP_MMDB_PATH = './test.mmdb';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const controller = module.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should provide AppService', async () => {
    process.env.DBIP_MMDB_PATH = './test.mmdb';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const service = module.get<AppService>(AppService);
    expect(service).toBeDefined();
  });
});
