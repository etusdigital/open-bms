import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EntityNotFoundExceptionFilter } from './filters/entity-not-found-exception.filter';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '5mb' }));
  app.enableCors({
    origin: '*',
    methods: 'GET, POST, OPTIONS',
    preflightContinue: false,
  });
  app.useGlobalFilters(new EntityNotFoundExceptionFilter());
  await app.listen(process.env.PORT || 3000);
}
void bootstrap();
