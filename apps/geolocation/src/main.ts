import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

export async function bootstrap() {
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
