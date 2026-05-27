export interface IpRequest {
  ip: string;
}

export interface Traits {
  asn: number;
  asnOrg: string;
  isp: string;
  organization: string;
  userType: string;
  connectionType: string;
  isAnycast: boolean;
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StatusRequest {}

export interface GeoIpStatus {
  tier: string;
  mmdbPath: string;
  mmdbSizeBytes: number;
  mmdbMtimeMs: number;
  lastReloadAt: string;
  lookupCount: number;
  ready: boolean;
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
