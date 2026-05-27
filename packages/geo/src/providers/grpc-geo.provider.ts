import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { GeoProvider, GeoData, GeoIpServiceClient } from '../geo-provider.interface';

export const GEO_GRPC_CLIENT = 'GEO_GRPC_CLIENT';

@Injectable()
export class GrpcGeoProvider implements GeoProvider, OnModuleInit {
  private geoIpService!: GeoIpServiceClient;

  constructor(@Inject(GEO_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.geoIpService = this.client.getService<GeoIpServiceClient>('GeoIpService');
  }

  async lookup(ip: string): Promise<GeoData | null> {
    try {
      const response = await lastValueFrom(this.geoIpService.getLocation({ ip }));
      if (!response.success) return null;
      return {
        country: response.country || undefined,
        region: response.region || undefined,
        city: response.city || undefined,
        traits: response.traits,
      };
    } catch {
      return null;
    }
  }
}
