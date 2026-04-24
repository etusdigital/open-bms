import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { EventPublisherService } from './event-publisher.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1048576, // 1MB in bytes
    }),
  );

  app.enableCors();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[bootstrap] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[bootstrap] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      try {
        const publisher = app.get(EventPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[bootstrap] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[bootstrap] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3011, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed:', err);
  process.exit(1);
});
