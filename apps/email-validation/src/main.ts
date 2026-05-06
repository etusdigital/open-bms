// Load credentials managed by msgops-api at /super-admin/integrations/emailable.
// MUST come before any module that reads EMAILABLE_URL/EMAILABLE_API_KEY.
// Inline KEY=VALUE parser to avoid extra runtime deps.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    process.env[key] = line.slice(eq + 1);
  }
}
loadEnvFile(join(process.env.BMS_CONFIG_DIR ?? '/data/config', 'emailable.env'));

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const host = '0.0.0.0';
  const port = process.env.PORT || 3000;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      ignoreTrailingSlash: true,
    }),
  );

  app.enableCors();

  await app.listen(port, host, (err) => {
    if (err) throw err;
    console.log(`Server listening on: ${port}`);
  });
}

bootstrap();
