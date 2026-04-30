import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { credentials } from '@grpc/grpc-js';
import { join } from 'path';
import { GrpcGeoProvider, GEO_GRPC_CLIENT } from './providers/grpc-geo.provider';
import { NoopGeoProvider } from './providers/noop-geo.provider';
import { ApiGeoProvider } from './providers/api-geo.provider';

export const GEO_PROVIDER_TOKEN = 'GEO_PROVIDER_TOKEN';

@Module({})
export class GeoModule {
  static register(): DynamicModule {
    const providerType = process.env.GEO_PROVIDER ?? 'local';

    if (providerType === 'local') {
      const grpcUrl =
        process.env.GEO_GRPC_URL || process.env.GEOIP_SERVICE_URL || 'localhost:50051';
      const isProduction = process.env.NODE_ENV === 'production';

      return {
        module: GeoModule,
        imports: [
          ClientsModule.register([
            {
              name: GEO_GRPC_CLIENT,
              transport: Transport.GRPC,
              options: {
                package: 'geoip',
                protoPath: join(__dirname, './geoip.proto'),
                url: grpcUrl,
                ...(isProduction && { credentials: credentials.createSsl() }),
              },
            },
          ]),
        ],
        providers: [
          GrpcGeoProvider,
          { provide: GEO_PROVIDER_TOKEN, useExisting: GrpcGeoProvider },
        ],
        exports: [GEO_PROVIDER_TOKEN],
      };
    }

    if (providerType === 'api') {
      return {
        module: GeoModule,
        providers: [
          ApiGeoProvider,
          { provide: GEO_PROVIDER_TOKEN, useExisting: ApiGeoProvider },
        ],
        exports: [GEO_PROVIDER_TOKEN],
      };
    }

    // 'disabled' or any unknown value → NoopGeoProvider
    return {
      module: GeoModule,
      providers: [
        NoopGeoProvider,
        { provide: GEO_PROVIDER_TOKEN, useExisting: NoopGeoProvider },
      ],
      exports: [GEO_PROVIDER_TOKEN],
    };
  }
}
