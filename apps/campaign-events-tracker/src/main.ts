import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CampaignEventsConsumerService } from './campaign-events-consumer.service';
import { RedisService } from './providers/redis/redis.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;
// Fail loud during boot if Redis can't be reached — the previous mode
// (ioredis retrying forever in the background) left the container marked
// "running" but it never consumed events, so the Swarm restart policy
// couldn't help. Exiting with code 1 makes Swarm spin up a fresh task
// after the DNS overlay has settled.
const REDIS_BOOT_TIMEOUT_MS = 60_000;

async function bootstrap() {
  const port = process.env.PORT || 3004;

  if (process.env.NODE_ENV === 'production') {
    const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
    if (token === '' || token.startsWith('dev-') || token.length < 24) {
      throw new Error(
        '[campaign-events-tracker] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)',
      );
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      throw new Error('[campaign-events-tracker] BRIDGE_ENDPOINT must be set explicitly in production');
    }
  }

  const bridgeEndpoint = process.env.BRIDGE_ENDPOINT ?? `http://localhost:${port}`;

  const app = await NestFactory.create(AppModule);

  const consumer = app.get(CampaignEventsConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[campaign-events-tracker] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[campaign-events-tracker] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (err) {
          console.error('[campaign-events-tracker] consumer stop failed:', err);
        }
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[campaign-events-tracker] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  // Verify Redis is actually reachable before opening the HTTP port and
  // attaching to RabbitMQ — otherwise the worker advertises itself as
  // ready while every Redis op silently queues in the offline buffer.
  // The RedisService's onModuleInit already calls connect(), but
  // ioredis's `lazyConnect: true` + retryStrategy don't surface DNS
  // failures as a rejected promise. A direct ping with a hard timeout
  // does.
  try {
    const redis = app.get(RedisService).getClient();
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`redis_boot_timeout_after_${REDIS_BOOT_TIMEOUT_MS}ms`)),
          REDIS_BOOT_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    console.error('[campaign-events-tracker] redis unreachable at boot, exiting for Swarm restart:', err);
    process.exit(1);
  }

  await app.listen(port);

  await consumer.start(bridgeEndpoint);
  consumerStarted = true;

  console.log(`Server listening on: ${port}`);
}

bootstrap().catch((err) => {
  console.error('[campaign-events-tracker] bootstrap failed:', err);
  process.exit(1);
});
