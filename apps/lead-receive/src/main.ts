import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LeadPublisherService } from './providers/lead-publisher.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const port = process.env.PORT || 8080;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[lead-receive] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[lead-receive] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      try {
        const publisher = app.get(LeadPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[lead-receive] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[lead-receive] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(port);
  console.log(`Server listening on: ${port}`);
}

bootstrap().catch((err) => {
  console.error('[lead-receive] bootstrap failed:', err);
  process.exit(1);
});
