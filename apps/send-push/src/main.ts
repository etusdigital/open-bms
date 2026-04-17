import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const host = '0.0.0.0';
  const port = process.env.PORT || 3000;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 10485760,
    })
  );
  await app.listen(port, host, (err) => {
    if (err) throw err;
    console.log(`Server listening on: ${port}`);
  });
}

bootstrap();
