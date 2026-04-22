import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ProbeConsumerService } from './probe-consumer.service';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && process.env.INTERNAL_AUTH_TOKEN === 'dev-probe-token') {
    throw new Error('[probe] refuse to boot with default INTERNAL_AUTH_TOKEN in production');
  }

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 1048576 }));

  await app.listen(process.env.PORT || 3012, '0.0.0.0');

  // Start the AMQP consumer AFTER Fastify is listening — avoids ECONNREFUSED
  // on attempt 1 when the first message arrives before the HTTP bridge is bound.
  const probeConsumer = app.get(ProbeConsumerService);
  await probeConsumer.start();

  const shutdown = async (signal: string) => {
    console.log(`[probe] received ${signal}`);
    try {
      await probeConsumer.stop();
    } catch (err) {
      console.error('[probe] consumer stop failed:', err);
    }
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
bootstrap();
