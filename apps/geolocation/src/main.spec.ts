const mockListen = jest.fn().mockResolvedValue(undefined);
const mockCreateMicroservice = jest.fn().mockResolvedValue({
  listen: mockListen,
});

jest.mock('@nestjs/core', () => ({
  NestFactory: { createMicroservice: mockCreateMicroservice },
}));

jest.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

jest.mock('@nestjs/microservices', () => ({
  Transport: { GRPC: 'GRPC' },
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args: string[]) => args.join('/')),
}));

describe('bootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.HOST;
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create a gRPC microservice and start listening', async () => {
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(mockCreateMicroservice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        transport: 'GRPC',
        options: expect.objectContaining({
          package: 'geoip',
        }),
      }),
    );
    expect(mockListen).toHaveBeenCalled();
  });

  it('should use default host 0.0.0.0 and port 50051 when env vars are not set', async () => {
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(mockCreateMicroservice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        options: expect.objectContaining({
          url: '0.0.0.0:50051',
        }),
      }),
    );
  });

  it('should use HOST and PORT env vars when set', async () => {
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '9090';

    const { bootstrap } = require('./main');
    await bootstrap();

    expect(mockCreateMicroservice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        options: expect.objectContaining({
          url: '127.0.0.1:9090',
        }),
      }),
    );
  });

  it('should pass the proto path option', async () => {
    const { bootstrap } = require('./main');
    await bootstrap();

    expect(mockCreateMicroservice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        options: expect.objectContaining({
          protoPath: expect.stringContaining('geoip.proto'),
        }),
      }),
    );
  });
});
