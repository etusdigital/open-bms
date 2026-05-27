import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { EventPublisherService } from './event-publisher.service';
import { EventProcessConsumerService } from './event-process-consumer.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
    if (token === '' || token.startsWith('dev-') || token.length < 24) {
      throw new Error(
        '[event-process] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)',
      );
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      throw new Error('[event-process] BRIDGE_ENDPOINT must be set explicitly in production');
    }
  } else if (!process.env.BRIDGE_ENDPOINT) {
    process.env.BRIDGE_ENDPOINT = `http://localhost:${process.env.PORT || 3000}`;
  }

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 5242880 }));

  const consumer = app.get(EventProcessConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[event-process] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[event-process] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (err) {
          console.error('[event-process] consumer stop failed:', err);
        }
      }
      try {
        const publisher = app.get(EventPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[event-process] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[event-process] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3000, process.env.HOST || '0.0.0.0');

  await consumer.start();
  consumerStarted = true;
}

bootstrap().catch((err) => {
  console.error('[event-process] bootstrap failed:', err);
  process.exit(1);
});
