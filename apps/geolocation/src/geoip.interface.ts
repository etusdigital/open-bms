export interface IpRequest {
  ip: string;
}

export interface LocationResponse {
  country: string;
  region: string;
  city: string;
  postalCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
  success: boolean;
  error?: string;
}

export interface GeoIpLookupResult {
  country?: { iso_code?: string };
  subdivisions?: Array<{ iso_code?: string }>;
  city?: { names?: { en?: string } };
  postal?: { code?: string };
  location?: { time_zone?: string; latitude?: string; longitude?: string };
}
