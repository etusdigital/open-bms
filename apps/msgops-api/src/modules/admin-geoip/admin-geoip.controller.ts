import { Body, Controller, Get, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../authz/require-super-admin.decorator';
import { AdminGeoIpService, type GeoIpAdminSavePayload, type GeoIpAdminSettings } from './admin-geoip.service';
import { GeoIpStatusResponseDto } from './dtos/geoip-status-response.dto';

@Controller('admin/geoip')
export class AdminGeoIpController {
  constructor(private readonly service: AdminGeoIpService) {}

  @Get('status')
  @RequireSuperAdmin()
  status(): Promise<GeoIpStatusResponseDto> {
    return this.service.getStatus();
  }

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<GeoIpAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: GeoIpAdminSavePayload): Promise<GeoIpAdminSettings> {
    return this.service.saveSettings(payload);
  }
}
