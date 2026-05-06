import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Mock fs and mmdb-reader before AppModule imports AppService
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from('')),
  existsSync: jest.fn().mockReturnValue(false),
  statSync: jest.fn().mockReturnValue({
    size: 0,
    mtimeMs: 0,
    mtime: new Date(0),
  }),
  watch: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
}));
jest.mock('mmdb-reader', () => {
  return function () {
    return { lookup: jest.fn() };
  };
});

describe('AppModule', () => {
  it('should compile the real AppModule with ConfigModule', async () => {
    process.env.GEO_MMDB_DIR = './test';
    process.env.GEO_TIER = 'lite';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();
  });

  it('should provide AppController', async () => {
    process.env.GEO_MMDB_DIR = './test';
    process.env.GEO_TIER = 'lite';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const controller = module.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should provide AppService', async () => {
    process.env.GEO_MMDB_DIR = './test';
    process.env.GEO_TIER = 'lite';

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const service = module.get<AppService>(AppService);
    expect(service).toBeDefined();
  });
});
