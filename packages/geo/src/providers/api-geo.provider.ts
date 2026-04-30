import { Injectable } from '@nestjs/common';
import { GeoProvider, GeoData } from '../geo-provider.interface';

interface IpApiResponse {
  status: string;
  country: string;
  regionName: string;
  city: string;
}

@Injectable()
export class ApiGeoProvider implements GeoProvider {
  async lookup(ip: string): Promise<GeoData | null> {
    try {
      const apiKey = process.env.GEO_API_KEY ?? '';
      const url = apiKey
        ? `https://pro.ip-api.com/json/${ip}?fields=status,country,regionName,city&key=${apiKey}`
        : `http://ip-api.com/json/${ip}?fields=status,country,regionName,city`;

      const res = await fetch(url);
      if (!res.ok) return null;

      const data = (await res.json()) as IpApiResponse;
      if (data.status !== 'success') return null;

      return {
        country: data.country || undefined,
        region: data.regionName || undefined,
        city: data.city || undefined,
      };
    } catch {
      return null;
    }
  }
}
