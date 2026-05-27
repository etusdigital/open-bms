import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminMailerSendService, type MailerSendAdminSettings } from './admin-mailersend.service';
import { MailerSendSystemSettingsDto, MailerSendTestConnectionDto } from './dtos/mailersend-system-settings.dto';

@Controller('admin/integrations/mailersend')
export class AdminMailerSendController {
  constructor(private readonly service: AdminMailerSendService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<MailerSendAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: MailerSendSystemSettingsDto): Promise<MailerSendAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: MailerSendTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
