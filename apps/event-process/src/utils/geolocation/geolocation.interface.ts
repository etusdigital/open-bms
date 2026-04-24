import { Observable } from 'rxjs';

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

export interface GeolocationServiceClient {
  getLocation(data: IpRequest): Observable<LocationResponse>;
}
