import { Body, Controller, ForbiddenException, Get, Post, Put, Req } from '@nestjs/common';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { SendgridSettingsDto, TestSendgridSettingsDto } from './dtos/sendgrid-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  private requireSuperAdmin(req: any) {
    const context = req?.authzContext;
    if (!context?.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  @Get('sendgrid')
  async getSendgrid(@Req() req: any) {
    this.requireSuperAdmin(req);
    return (await this.settingsService.getSendgrid()) ?? null;
  }

  @Put('sendgrid')
  async saveSendgrid(@Body() dto: SendgridSettingsDto, @Req() req: any) {
    this.requireSuperAdmin(req);
    await this.settingsService.saveSendgrid(dto);
    return { ok: true };
  }

  @Post('sendgrid/test')
  testSendgrid(@Body() dto: TestSendgridSettingsDto, @Req() req: any, @IpAddress() ip?: string) {
    this.requireSuperAdmin(req);
    return this.settingsService.testSendgrid(dto.apiKey, ip);
  }
}
