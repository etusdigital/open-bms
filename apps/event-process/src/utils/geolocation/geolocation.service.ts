import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';
import { LocationResponse, GeolocationServiceClient } from './geolocation.interface';

@Injectable()
export class GeolocationService implements OnModuleInit {
  private geolocationService: GeolocationServiceClient;

  constructor(@Inject('GEOLOCATION_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.geolocationService = this.client.getService<GeolocationServiceClient>('GeoIpService');
  }

  getLocationObservable(ip: string): Observable<LocationResponse> {
    return this.geolocationService.getLocation({ ip });
  }

  async getLocation(ip: string): Promise<LocationResponse> {
    return lastValueFrom(this.geolocationService.getLocation({ ip }));
  }
}
