import { QueueModule } from './queue.module';

describe('QueueModule.onModuleInit — CRON_SECRET boot guard', () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('throws at boot when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    const mod = new QueueModule();
    expect(() => mod.onModuleInit()).toThrow(/CRON_SECRET/);
  });

  it('passes when CRON_SECRET is set', () => {
    process.env.CRON_SECRET = 'test-secret';
    const mod = new QueueModule();
    expect(() => mod.onModuleInit()).not.toThrow();
  });
});
