// MUST be first: populates process.env from .env before any module-top-level env reads.
import './env-loader';

import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createCorsOptions, createPublicCorsOptions } from './cors.config';
import { JoiPipe } from 'nestjs-joi';
import { TelemetryService } from './modules/telemetry/telemetry.service';
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
  dsn: process.env.SENTRY_DSN,
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

  // The email-reconcile flow (/imports/:jobId/reconcile/*) receives whole CSV
  // exports embedded in the JSON body — 350k contacts easily exceed 20mb — so
  // these routes get their own higher limit instead of raising the global one,
  // which also guards public webhook endpoints. Must stay registered BEFORE
  // the global parser (body-parser skips requests already parsed). Keep in
  // sync with client_max_body_size in apps/frontend-react/nginx.conf.
  app.use(
    '/imports',
    bodyParser.json({
      limit: '64mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  // Captures the raw body alongside the parsed JSON. Webhook controllers
  // (e.g. POST /webhooks/meta and /webhooks/evolution-hub) need it to compute
  // HMAC-SHA256 signatures from the exact bytes the sender hashed.
  app.use(
    bodyParser.json({
      limit: '16mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  // Browser web-push/tracker clients (web-push.js, bmstrk.js) POST with
  // `mode: 'no-cors'`, which forces Content-Type to text/plain and the browser
  // won't send a custom api-key header. The bodies are still JSON (with apiKey
  // inside). Parse text/plain as JSON too so those payloads deserialize and the
  // body-apiKey middleware can authenticate them. Bad/non-JSON text/plain bodies
  // are ignored (body-parser leaves req.body undefined on parse failure here).
  app.use(
    bodyParser.json({
      limit: '1mb',
      type: 'text/plain',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  // Public tracking/web-push routes (/bms/*, /c) get an open CORS policy first —
  // they're called from arbitrary customer domains and auth by api-key, not the
  // restricted allowlist. The catch-all cors below still governs the admin app.
  const publicCors = cors(createPublicCorsOptions());
  app.use(['/bms', '/c'], publicCors);
  app.use(cors(createCorsOptions()));

  app.useGlobalPipes(new JoiPipe());

  // Initialize ETUS Open Telemetry SDK. Never blocks boot on failure.
  try {
    await app.get(TelemetryService).initOnBootstrap();
  } catch (e) {
    Sentry.captureException(e);
  }

  await app.listen(process.env.SERVER_PORT);
}

bootstrap();
