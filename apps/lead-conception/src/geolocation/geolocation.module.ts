import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GeolocationService } from './geolocation.service';
import { credentials } from '@grpc/grpc-js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'GEOLOCATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'geoip',
          protoPath: join(__dirname, './geoip.proto'),
          url: process.env.GEOIP_SERVICE_URL || 'localhost:50051',
          ...(process.env.NODE_ENV === 'production' && { credentials: credentials.createSsl() }),
        },
      },
    ]),
  ],
  providers: [GeolocationService],
  exports: [GeolocationService],
})
export class GeolocationModule {}
