import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { EventPublisherService } from './event-publisher.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1048576, // 1MB in bytes
    }),
  );

  app.enableCors();

  const shutdown = async (signal: string) => {
    console.log(`[bootstrap] received ${signal}, shutting down`);
    try {
      const publisher = app.get(EventPublisherService);
      await publisher.close();
    } catch (err) {
      console.error('[bootstrap] publisher close failed:', err);
    }
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3011, '0.0.0.0');
}
bootstrap();
