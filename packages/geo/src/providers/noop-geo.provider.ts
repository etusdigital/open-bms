import { Injectable } from '@nestjs/common';
import { GeoProvider, GeoData } from '../geo-provider.interface';

@Injectable()
export class NoopGeoProvider implements GeoProvider {
  async lookup(_ip: string): Promise<GeoData | null> {
    return null;
  }
}
