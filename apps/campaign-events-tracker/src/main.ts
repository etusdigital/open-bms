import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT || 3004;

  const app = await NestFactory.create(AppModule);
  await app.listen(port);

  console.log(`Server listening on: ${port}`);
}
bootstrap();
