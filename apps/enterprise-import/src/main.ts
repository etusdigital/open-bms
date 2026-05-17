import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  const logger = new Logger('enterprise-import');

  // HTTP app: processes BullMQ jobs and exposes /health for k8s probes.
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.enableShutdownHooks();
  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port);
  logger.log(`health endpoint listening on :${port}/health`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`received ${signal}, shutting down`);
    const watchdog = setTimeout(() => {
      logger.error('shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      logger.error(`shutdown error: ${(err as Error)?.message}`);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  logger.log('worker ready, listening for jobs on queue=enterprise-import');
}

bootstrap().catch((err) => {
  console.error('[enterprise-import] bootstrap failed:', err);
  process.exit(1);
});
