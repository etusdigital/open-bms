import { Body, Controller, Get, Ip, Post, Put } from '@nestjs/common';
import { RequireSuperAdmin } from '../../authz/require-super-admin.decorator';
import { AdminS3Service, type S3AdminSettings } from './admin-s3.service';
import { S3SettingsDto, S3TestConnectionDto } from './dtos/s3-settings.dto';

@Controller('admin/integrations/s3')
export class AdminS3Controller {
  constructor(private readonly service: AdminS3Service) {}

  @Get('settings')
  @RequireSuperAdmin()
  getSettings(): Promise<S3AdminSettings | null> {
    return this.service.getSettings();
  }

  @Get('configured')
  async isConfigured(): Promise<{ configured: boolean }> {
    const settings = await this.service.getSettings();
    return { configured: !!settings?.bucket };
  }

  @Put('settings')
  @RequireSuperAdmin()
  saveSettings(@Body() payload: S3SettingsDto): Promise<S3AdminSettings> {
    return this.service.saveSettings(payload);
  }

  @Post('test-connection')
  @RequireSuperAdmin()
  testConnection(@Body() payload: S3TestConnectionDto, @Ip() requesterIp: string): Promise<{ ok: boolean; errorMessage?: string }> {
    return this.service.testConnection(payload, requesterIp);
  }
}
