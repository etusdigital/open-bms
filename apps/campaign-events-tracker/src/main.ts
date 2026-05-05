import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CampaignEventsConsumerService } from './campaign-events-consumer.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

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
  } else if (!process.env.BRIDGE_ENDPOINT) {
    process.env.BRIDGE_ENDPOINT = `http://localhost:${port}`;
  }

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

  await app.listen(port);

  await consumer.start();
  consumerStarted = true;

  console.log(`Server listening on: ${port}`);
}

bootstrap().catch((err) => {
  console.error('[campaign-events-tracker] bootstrap failed:', err);
  process.exit(1);
});
