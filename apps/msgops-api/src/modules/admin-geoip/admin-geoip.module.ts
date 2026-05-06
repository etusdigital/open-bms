import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { credentials } from '@grpc/grpc-js';
import { join } from 'path';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { AdminGeoIpController } from './admin-geoip.controller';
import { AdminGeoIpService } from './admin-geoip.service';

// We register a private gRPC client here instead of importing
// GeoModule.register() because the existing module exposes the GeoProvider
// abstraction (lookup-only). Status / refresh diagnostics need access to the
// raw RPC surface, and giving the admin module its own client keeps the
// public GeoModule API focused on enrichment.
@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfigEntity]),
    ClientsModule.register([
      {
        name: 'GEO_GRPC_CLIENT_ADMIN',
        transport: Transport.GRPC,
        options: {
          package: 'geoip',
          // Local proto copy (also lives in apps/geolocation and packages/geo
          // — see ADR docs/plans/2026-04-30-adr-geo-grpc-architecture.md for
          // the consolidation follow-up).
          protoPath: join(__dirname, 'geoip.proto'),
          url: process.env.GEO_GRPC_URL || process.env.GEOIP_SERVICE_URL || 'localhost:50051',
          ...(process.env.NODE_ENV === 'production' && {
            credentials: credentials.createSsl(),
          }),
        },
      },
    ]),
  ],
  controllers: [AdminGeoIpController],
  providers: [AdminGeoIpService],
})
export class AdminGeoIpModule {}
