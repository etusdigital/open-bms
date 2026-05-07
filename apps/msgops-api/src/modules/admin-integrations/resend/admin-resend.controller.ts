import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminResendService, type ResendAdminSettings } from './admin-resend.service';
import { ResendSystemSettingsDto, ResendTestConnectionDto } from './dtos/resend-system-settings.dto';

@Controller('admin/integrations/resend')
export class AdminResendController {
  constructor(private readonly service: AdminResendService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<ResendAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: ResendSystemSettingsDto): Promise<ResendAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: ResendTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
