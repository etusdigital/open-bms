// Load credentials managed by msgops-api at /super-admin/integrations.
// MUST come before any module that reads S3_*/SENDGRID_* env vars.
// Inline KEY=VALUE parser to avoid extra runtime deps.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    process.env[key] = line.slice(eq + 1);
  }
}
const BMS_CONFIG_DIR = process.env.BMS_CONFIG_DIR ?? '/data/config';
loadEnvFile(join(BMS_CONFIG_DIR, 's3.env'));
loadEnvFile(join(BMS_CONFIG_DIR, 'sendgrid.env'));

import { NestFactory } from '@nestjs/core';
import { json } from 'body-parser';
import { AppModule } from './app.module';
import { EventPublisherService } from './event-publisher.service';
import { SendEmailConsumerService } from './send-email-consumer.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
    if (token === '' || token.startsWith('dev-') || token.length < 24) {
      throw new Error('[send-email] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)');
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      throw new Error('[send-email] BRIDGE_ENDPOINT must be set explicitly in production');
    }
  } else if (!process.env.BRIDGE_ENDPOINT) {
    process.env.BRIDGE_ENDPOINT = `http://localhost:${process.env.PORT || 3000}`;
  }

  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }));

  const consumer = app.get(SendEmailConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[send-email] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[send-email] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (err) {
          console.error('[send-email] consumer stop failed:', err);
        }
      }
      try {
        const publisher = app.get(EventPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[send-email] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[send-email] shutdown error:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3000);

  await consumer.start();
  consumerStarted = true;
}

bootstrap().catch((err) => {
  console.error('[send-email] bootstrap failed:', err);
  process.exit(1);
});
