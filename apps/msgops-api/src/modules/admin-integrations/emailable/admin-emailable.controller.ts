import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminEmailableService, type EmailableAdminSettings } from './admin-emailable.service';
import { EmailableSettingsDto, EmailableTestConnectionDto } from './dtos/emailable-settings.dto';

@Controller('admin/integrations/emailable')
export class AdminEmailableController {
  constructor(private readonly service: AdminEmailableService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<EmailableAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: EmailableSettingsDto): Promise<EmailableAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: EmailableTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
