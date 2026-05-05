import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';
import { EventPublisherService } from './providers/messaging/event-publisher.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const port = process.env.PORT || 3001;

  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }));

  // Force eager init so OnModuleInit runs ensureReady() before we accept traffic.
  app.get(EventPublisherService);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[campaign-packer] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[campaign-packer] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      try {
        const publisher = app.get(EventPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[campaign-packer] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[campaign-packer] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(port);

  console.log(`Server listening on: ${port}`);
}

bootstrap().catch((err) => {
  console.error('[campaign-packer] bootstrap failed:', err);
  process.exit(1);
});
