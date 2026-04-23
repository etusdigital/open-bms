export interface IpRequest {
  ip: string;
}

export interface Traits {
  asn: number;
  asn_org: string;
  isp: string;
  organization: string;
  user_type: string;
  connection_type: string;
  is_anycast: boolean;
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
  traits?: Traits;
}

export interface GeoIpLookupResult {
  country?: { iso_code?: string };
  subdivisions?: Array<{ iso_code?: string }>;
  city?: { names?: { en?: string } };
  postal?: { code?: string };
  location?: { time_zone?: string; latitude?: string; longitude?: string };
  traits?: {
    autonomous_system_number?: number;
    autonomous_system_organization?: string;
    isp?: string;
    organization?: string;
    user_type?: string;
    connection_type?: string;
    is_anycast?: boolean;
  };
}
