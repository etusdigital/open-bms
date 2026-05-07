import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminSesService, type SesAdminSettings } from './admin-ses.service';
import { SesSystemSettingsDto, SesTestConnectionDto } from './dtos/ses-system-settings.dto';

@Controller('admin/integrations/ses')
export class AdminSesController {
  constructor(private readonly service: AdminSesService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<SesAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: SesSystemSettingsDto): Promise<SesAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: SesTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
