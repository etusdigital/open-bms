import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const port = process.env.PORT || 3001;

  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }));
  await app.listen(port);

  console.log(`Server listening on: ${port}`);
}
bootstrap();
