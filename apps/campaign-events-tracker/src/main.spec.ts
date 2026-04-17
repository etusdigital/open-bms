import { NestFactory } from '@nestjs/core';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      listen: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

describe('Main', () => {
  const originalLog = console.log;

  beforeEach(() => {
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    jest.resetModules();
  });

  it('should bootstrap the application', async () => {
    await import('./main');
    expect(NestFactory.create).toHaveBeenCalled();
  });
});
