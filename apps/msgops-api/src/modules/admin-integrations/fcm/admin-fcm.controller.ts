import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminFcmService, type FcmAdminSettings } from './admin-fcm.service';
import { FcmSettingsDto, FcmTestConnectionDto } from './dtos/fcm-settings.dto';

@Controller('admin/integrations/fcm')
export class AdminFcmController {
  constructor(private readonly service: AdminFcmService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<FcmAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: FcmSettingsDto): Promise<FcmAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: FcmTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; projectId?: string; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
