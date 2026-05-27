// MUST be first: populates process.env from .env before any module-top-level env reads.
import './env-loader';

import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createCorsOptions } from './cors.config';
import { JoiPipe } from 'nestjs-joi';
// Sentinel committed in docker-compose.yml so `git clone && docker compose up`
// boots in dev. Refuse to start in production with these values — anyone who
// pulled the OSS repo would otherwise share the same forge-friendly secret.
const INSECURE_DEV_SENTINEL_PREFIX = 'INSECURE_DEV_ONLY_';

function assertAuthEnvs(): void {
  const mode = (process.env.AUTH_PROVIDER || 'local').toLowerCase();
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (mode === 'local') {
    if (!process.env.JWT_SECRET) throw new Error('AUTH_PROVIDER=local requires JWT_SECRET');
    if (!process.env.JWT_AUDIENCE) throw new Error('AUTH_PROVIDER=local requires JWT_AUDIENCE');
    if (isProduction && process.env.JWT_SECRET.startsWith(INSECURE_DEV_SENTINEL_PREFIX)) {
      throw new Error('Refusing to boot: NODE_ENV=production but JWT_SECRET still uses the committed dev sentinel. Rotate with `openssl rand -hex 32`.');
    }
    if (isProduction && process.env.INTERNAL_AUTH_TOKEN?.startsWith(INSECURE_DEV_SENTINEL_PREFIX)) {
      throw new Error('Refusing to boot: NODE_ENV=production but INTERNAL_AUTH_TOKEN still uses the committed dev sentinel.');
    }
  } else if (mode === 'auth0') {
    if (!process.env.JWKS_URI) throw new Error('AUTH_PROVIDER=auth0 requires JWKS_URI');
    if (!process.env.IDP_AUDIENCE) throw new Error('AUTH_PROVIDER=auth0 requires IDP_AUDIENCE');
    if (!process.env.IDP_ISSUER) throw new Error('AUTH_PROVIDER=auth0 requires IDP_ISSUER');
  } else {
    throw new Error(`Invalid AUTH_PROVIDER: ${mode}`);
  }
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://b08f403cda1540fa97ca676076e97ab8@o516495.ingest.sentry.io/6144429',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

async function bootstrap() {
  assertAuthEnvs();
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
