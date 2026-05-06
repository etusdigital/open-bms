import { Controller } from '@nestjs/common';
import { GeoIpStatus, IpRequest, LocationResponse } from './geoip.interface';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod('GeoIpService', 'GetLocation')
  getLocation(data: IpRequest): LocationResponse {
    return this.appService.getLocation(data.ip);
  }

  @GrpcMethod('GeoIpService', 'GetStatus')
  getStatus(): GeoIpStatus {
    return this.appService.getStatus();
  }
}
