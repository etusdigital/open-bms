import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ProbeConsumerService } from './probe-consumer.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
    if (token === 'dev-probe-token' || token.length < 24) {
      throw new Error(
        '[probe] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)',
      );
    }
  }

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 1048576 }));
  const probeConsumer = app.get(ProbeConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[probe] received ${signal}`);
    const watchdog = setTimeout(() => {
      console.error('[probe] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await probeConsumer.stop();
        } catch (err) {
          console.error('[probe] consumer stop failed:', err);
        }
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[probe] shutdown error:', err);
      process.exit(1);
    }
  };

  // Register BEFORE listen/start so a SIGTERM during topology assertion is handled gracefully.
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3012, '0.0.0.0');

  // Start the AMQP consumer AFTER Fastify is listening — avoids ECONNREFUSED
  // on attempt 1 when the first message arrives before the HTTP bridge is bound.
  await probeConsumer.start();
  consumerStarted = true;
}

bootstrap().catch((err) => {
  console.error('[probe] bootstrap failed:', err);
  process.exit(1);
});
