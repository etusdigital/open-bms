import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Applies /data/config/geoip.env (written by the BMS setup wizard) to
// process.env before any module initialises. This makes GEO_TIER and
// credential vars visible to AppService without a container restart after
// the wizard runs. Runs unconditionally — if the file is absent the service
// falls back to whatever is already in process.env (env_file / shell env).
function loadWizardConfig(): void {
  const configFile = join(process.env.BMS_CONFIG_DIR ?? '/data/config', 'geoip.env');
  if (!existsSync(configFile)) return;
  for (const line of readFileSync(configFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

export async function bootstrap() {
  loadWizardConfig();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'geoip',
      protoPath: join(__dirname, 'geoip.proto'),
      url: `${process.env.HOST || '0.0.0.0'}:${process.env.PORT || 50051}`,
    },
  });
  await app.listen();
}

if (require.main === module) {
  bootstrap();
}
