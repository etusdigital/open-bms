import { Body, Controller, Get, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminWhatsappHubService, type WhatsappHubSystemAdminSettings } from './admin-whatsapp-hub.service';
import { WhatsappHubSystemSettingsDto } from './dtos/whatsapp-hub-system-settings.dto';

@Controller('admin/integrations/whatsapp-hub')
export class AdminWhatsappHubController {
  constructor(private readonly service: AdminWhatsappHubService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<WhatsappHubSystemAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: WhatsappHubSystemSettingsDto): Promise<WhatsappHubSystemAdminSettings> {
    return this.service.saveSettings(payload);
  }
}
