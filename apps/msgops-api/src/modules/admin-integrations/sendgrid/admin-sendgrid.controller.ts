import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminSendgridService, type SendgridSystemAdminSettings } from './admin-sendgrid.service';
import { SendgridSystemSettingsDto, SendgridSystemTestConnectionDto } from './dtos/sendgrid-system-settings.dto';

@Controller('admin/integrations/sendgrid')
export class AdminSendgridController {
  constructor(private readonly service: AdminSendgridService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<SendgridSystemAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: SendgridSystemSettingsDto): Promise<SendgridSystemAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: SendgridSystemTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; accountName?: string | null; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
