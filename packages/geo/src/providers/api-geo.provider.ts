import { Injectable, Logger } from '@nestjs/common';
import { GeoProvider, GeoData } from '../geo-provider.interface';

// ip-api.com response shape (free + Pro). Selected fields only.
interface IpApiResponse {
  status: string;
  country: string;
  regionName: string;
  city: string;
}

// ipinfo.io response shape. `country` is an ISO-2 code; `region` is the
// English subdivision name; `loc` is "lat,lng" (unused here).
interface IpInfoResponse {
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  bogon?: boolean;
}

type Vendor = 'ip-api' | 'ipinfo';

function pickVendor(): Vendor {
  const raw = (process.env.GEO_API_VENDOR ?? 'ip-api').toLowerCase();
  return raw === 'ipinfo' ? 'ipinfo' : 'ip-api';
}

@Injectable()
export class ApiGeoProvider implements GeoProvider {
  private readonly logger = new Logger(ApiGeoProvider.name);

  async lookup(ip: string): Promise<GeoData | null> {
    if (!ip) return null;
    const vendor = pickVendor();
    try {
      return vendor === 'ipinfo' ? await this.lookupIpInfo(ip) : await this.lookupIpApi(ip);
    } catch (error) {
      this.logger.warn(
        `geo_api_lookup_failed vendor=${vendor} ip=${ip} err=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async lookupIpApi(ip: string): Promise<GeoData | null> {
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
  }

  private async lookupIpInfo(ip: string): Promise<GeoData | null> {
    const apiKey = process.env.GEO_API_KEY ?? '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(`https://ipinfo.io/${ip}/json`, { headers });
    if (!res.ok) return null;

    const data = (await res.json()) as IpInfoResponse;
    // ipinfo returns {bogon: true} for private/reserved ranges instead of an
    // explicit error. Treat these as "no data" rather than throwing.
    if (data.bogon) return null;
    if (!data.country && !data.city && !data.region) return null;

    return {
      country: data.country || undefined,
      region: data.region || undefined,
      city: data.city || undefined,
    };
  }
}
