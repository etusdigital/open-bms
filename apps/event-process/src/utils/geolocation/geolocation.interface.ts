import { Observable } from 'rxjs';

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

export interface GeolocationServiceClient {
  getLocation(data: IpRequest): Observable<LocationResponse>;
}
