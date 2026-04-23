import { Observable } from 'rxjs';

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

export interface GeolocationServiceClient {
  getLocation(data: IpRequest): Observable<LocationResponse>;
}
