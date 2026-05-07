import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminMandrillService, type MandrillAdminSettings } from './admin-mandrill.service';
import { MandrillSystemSettingsDto, MandrillTestConnectionDto } from './dtos/mandrill-system-settings.dto';

@Controller('admin/integrations/mandrill')
export class AdminMandrillController {
  constructor(private readonly service: AdminMandrillService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<MandrillAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: MandrillSystemSettingsDto): Promise<MandrillAdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: MandrillTestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
