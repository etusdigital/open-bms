import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { EventPublisherService } from './event-publisher.service';
import { TwilioMessagingConsumerService } from './twilio-messaging-consumer.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const env = process.env.NODE_ENV;
  const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
  const tokenIsWeak = token === '' || token.startsWith('dev-') || token.length < 24;
  if (env === 'production') {
    if (tokenIsWeak) {
      throw new Error(
        '[twilio-messaging] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)',
      );
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      throw new Error('[twilio-messaging] BRIDGE_ENDPOINT must be set explicitly in production');
    }
  } else {
    if (env && env !== 'development' && env !== 'test' && tokenIsWeak) {
      console.warn(
        `[twilio-messaging] WARNING: weak/default INTERNAL_AUTH_TOKEN in NODE_ENV=${env} — set a real secret`,
      );
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      process.env.BRIDGE_ENDPOINT = `http://localhost:${process.env.PORT || 3000}`;
    }
  }

  const host = '0.0.0.0';
  const port = process.env.PORT || 3000;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 5242880,
    }),
  );

  const consumer = app.get(TwilioMessagingConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[twilio-messaging] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[twilio-messaging] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (err) {
          console.error('[twilio-messaging] consumer stop failed:', err);
        }
      }
      try {
        const publisher = app.get(EventPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[twilio-messaging] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[twilio-messaging] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(port, host);
  console.log(`Server listening on: ${port}`);

  await consumer.start();
  consumerStarted = true;
}

bootstrap().catch((err) => {
  console.error('[twilio-messaging] bootstrap failed:', err);
  process.exit(1);
});
