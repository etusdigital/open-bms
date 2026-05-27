import { Body, Controller, Get, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminWhatsappMetaService, type WhatsappMetaSystemAdminSettings } from './admin-whatsapp-meta.service';
import { WhatsappMetaSystemSettingsDto } from './dtos/whatsapp-meta-system-settings.dto';

@Controller('admin/integrations/whatsapp-meta')
export class AdminWhatsappMetaController {
  constructor(private readonly service: AdminWhatsappMetaService) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<WhatsappMetaSystemAdminSettings | null> {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: WhatsappMetaSystemSettingsDto): Promise<WhatsappMetaSystemAdminSettings> {
    return this.service.saveSettings(payload);
  }
}
