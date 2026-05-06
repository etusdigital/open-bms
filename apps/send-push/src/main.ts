// Load credentials managed by msgops-api at /super-admin/integrations/fcm.
// MUST come before any module that reads FIREBASE_SERVICE_ACCOUNT.
// Inline KEY=VALUE parser to avoid pulling in dotenv as a worker dep.
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
loadEnvFile(join(process.env.BMS_CONFIG_DIR ?? '/data/config', 'fcm.env'));

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { EventPublisherService } from './event-publisher.service';
import { SendPushConsumerService } from './send-push-consumer.service';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const env = process.env.NODE_ENV;
  const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
  const tokenIsWeak = token === '' || token.startsWith('dev-') || token.length < 24;
  if (env === 'production') {
    if (tokenIsWeak) {
      throw new Error(
        '[send-push] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)'
      );
    }
    if (!process.env.BRIDGE_ENDPOINT) {
      throw new Error('[send-push] BRIDGE_ENDPOINT must be set explicitly in production');
    }
  } else {
    if (env && env !== 'development' && env !== 'test' && tokenIsWeak) {
      console.warn(`[send-push] WARNING: weak/default INTERNAL_AUTH_TOKEN in NODE_ENV=${env} — set a real secret`);
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
      bodyLimit: 10485760,
    })
  );

  const consumer = app.get(SendPushConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[send-push] received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      console.error('[send-push] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (err) {
          console.error('[send-push] consumer stop failed:', err);
        }
      }
      try {
        const publisher = app.get(EventPublisherService);
        await publisher.close();
      } catch (err) {
        console.error('[send-push] publisher close failed:', err);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[send-push] shutdown error:', err);
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
  console.error('[send-push] bootstrap failed:', err);
  process.exit(1);
});
