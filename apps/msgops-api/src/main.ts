import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createCorsOptions } from './cors.config';
import { JoiPipe } from 'nestjs-joi';

dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://REDACTED-SENTRY-DSN',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.NODE_ENV !== 'production') {
    const options = new DocumentBuilder()
      .setTitle('Messaging Operations API - ETUS')
      .setDescription("ETU's API for messaging operations such as mailing, sms and push!")
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup(process.env.API_DOCS, app, document);
  }

  // Custom query parser with higher array limit — default qs limit of 20 converts large arrays to objects
  const qs = require('qs');
  app
    .getHttpAdapter()
    .getInstance()
    .set('query parser', (str: string) => {
      return qs.parse(str, { arrayLimit: 200 });
    });

  app.getHttpAdapter().getInstance().set('query parser', 'extended');

  app.use(bodyParser.json({ limit: '16mb' }));
  app.use(cookieParser());
  app.use(cors(createCorsOptions()));

  app.useGlobalPipes(new JoiPipe());
  await app.listen(process.env.SERVER_PORT);
}

bootstrap();
