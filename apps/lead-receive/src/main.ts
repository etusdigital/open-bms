import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const port = process.env.PORT || 8080;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors();

  await app.listen(port);

  console.log(`Server listening on: ${port}`);
}
void bootstrap();
