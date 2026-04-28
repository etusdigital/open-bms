import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { LeadConsumerService } from './consumers/lead-consumer.service';
import { TagPublisherService } from './publishers/tag-publisher.service';
import { EventPublisherService } from './publishers/event-publisher.service';
import { TriggerPublisherService } from './publishers/trigger-publisher.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const host = '0.0.0.0';
  const port = process.env.PORT || 3000;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 5242880,
    }),
  );

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[lead-conception] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[lead-conception] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          const consumer = app.get(LeadConsumerService);
          await consumer.stop();
        } catch (err) {
          console.error('[lead-conception] consumer stop failed:', err);
        }
      }
      for (const PublisherClass of [TagPublisherService, EventPublisherService, TriggerPublisherService]) {
        try {
          const publisher = app.get(PublisherClass);
          await publisher.close();
        } catch (err) {
          console.error(`[lead-conception] ${PublisherClass.name} close failed:`, err);
        }
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[lead-conception] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(port, host, (err) => {
    if (err) throw err;
    console.log(`Server listening on: ${port}`);
  });

  const consumer = app.get(LeadConsumerService);
  await consumer.start();
  consumerStarted = true;
  console.log('[lead-conception] consumer started');
}

bootstrap().catch((err) => {
  console.error('[lead-conception] bootstrap failed:', err);
  process.exit(1);
});
