import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AccountSettingsService } from './account-settings.service';
import { SaveAccountSendgridDto, TestAccountSendgridDto } from './dtos/sendgrid.dto';
import { SaveAccountMailersendDto, TestAccountMailersendDto } from './dtos/mailersend.dto';
import { SaveAccountSparkpostDto, TestAccountSparkpostDto } from './dtos/sparkpost.dto';
import { SaveAccountResendDto, TestAccountResendDto } from './dtos/resend.dto';
import { SaveAccountSesDto, TestAccountSesDto } from './dtos/ses.dto';
import { SaveAccountMandrillDto, TestAccountMandrillDto } from './dtos/mandrill.dto';
import { SaveAccountTwilioDto, TestAccountTwilioDto } from './dtos/twilio.dto';
import { SaveAccountPushDto, TestAccountPushDto } from './dtos/push.dto';

@Controller('accounts/:accountId/settings')
export class AccountSettingsController {
  constructor(private readonly service: AccountSettingsService) {}

  // Same pattern as AccountsController.assertAccountScope: super_admins
  // can act on any account; non-super principals can only act on the
  // account their token is bound to.
  private assertAccountScope(req: any, accountId: number) {
    const context = req?.authzContext;
    if (!context) throw new ForbiddenException('Authorization context required');
    if (context.isSuperAdmin) return;
    if (context.accountId && Number(context.accountId) !== Number(accountId)) {
      throw new ForbiddenException('Principal cannot access this account');
    }
  }

  @Get('sendgrid')
  @RequirePermission('account:settings_view')
  async getSendgrid(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getSendgrid(Number(accountId));
  }

  @Put('sendgrid')
  @RequirePermission('account:settings_update')
  async saveSendgrid(@Param('accountId') accountId: number, @Body() dto: SaveAccountSendgridDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveSendgrid(Number(accountId), dto);
  }

  @Delete('sendgrid')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteSendgrid(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteSendgrid(Number(accountId));
  }

  @Post('sendgrid/test')
  @RequirePermission('account:settings_view')
  async testSendgrid(@Param('accountId') accountId: number, @Body() dto: TestAccountSendgridDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testSendgrid(dto.apiKey, ip);
  }

  @Get('mailersend')
  @RequirePermission('account:settings_view')
  async getMailersend(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getMailersend(Number(accountId));
  }

  @Put('mailersend')
  @RequirePermission('account:settings_update')
  async saveMailersend(@Param('accountId') accountId: number, @Body() dto: SaveAccountMailersendDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveMailersend(Number(accountId), dto);
  }

  @Delete('mailersend')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteMailersend(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteMailersend(Number(accountId));
  }

  @Post('mailersend/test')
  @RequirePermission('account:settings_view')
  async testMailersend(@Param('accountId') accountId: number, @Body() dto: TestAccountMailersendDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testMailersend(dto.apiKey, ip);
  }

  @Get('sparkpost')
  @RequirePermission('account:settings_view')
  async getSparkpost(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getSparkpost(Number(accountId));
  }

  @Put('sparkpost')
  @RequirePermission('account:settings_update')
  async saveSparkpost(@Param('accountId') accountId: number, @Body() dto: SaveAccountSparkpostDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveSparkpost(Number(accountId), dto);
  }

  @Delete('sparkpost')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteSparkpost(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteSparkpost(Number(accountId));
  }

  @Post('sparkpost/test')
  @RequirePermission('account:settings_update')
  async testSparkpost(@Param('accountId') accountId: number, @Body() dto: TestAccountSparkpostDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testSparkpost(dto.apiKey, ip);
  }

  @Get('sparkpost/legacy-status')
  @RequirePermission('account:settings_view')
  async getSparkpostLegacyStatus(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getSparkpostLegacyStatus(Number(accountId));
  }

  @Post('sparkpost/migrate-legacy')
  @RequirePermission('account:settings_update')
  async migrateSparkpostLegacy(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.migrateSparkpostLegacy(Number(accountId));
  }

  @Get('resend')
  @RequirePermission('account:settings_view')
  async getResend(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getResend(Number(accountId));
  }

  @Put('resend')
  @RequirePermission('account:settings_update')
  async saveResend(@Param('accountId') accountId: number, @Body() dto: SaveAccountResendDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveResend(Number(accountId), dto);
  }

  @Delete('resend')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteResend(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteResend(Number(accountId));
  }

  @Post('resend/test')
  @RequirePermission('account:settings_update')
  async testResend(@Param('accountId') accountId: number, @Body() dto: TestAccountResendDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testResend(dto.apiKey, ip);
  }

  @Get('ses')
  @RequirePermission('account:settings_view')
  async getSes(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getSes(Number(accountId));
  }

  @Put('ses')
  @RequirePermission('account:settings_update')
  async saveSes(@Param('accountId') accountId: number, @Body() dto: SaveAccountSesDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveSes(Number(accountId), dto);
  }

  @Delete('ses')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteSes(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteSes(Number(accountId));
  }

  @Post('ses/test')
  @RequirePermission('account:settings_update')
  async testSes(@Param('accountId') accountId: number, @Body() dto: TestAccountSesDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testSes(dto.accessKeyId, dto.secretAccessKey, dto.region, ip);
  }

  @Get('mandrill')
  @RequirePermission('account:settings_view')
  async getMandrill(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getMandrill(Number(accountId));
  }

  @Put('mandrill')
  @RequirePermission('account:settings_update')
  async saveMandrill(@Param('accountId') accountId: number, @Body() dto: SaveAccountMandrillDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveMandrill(Number(accountId), dto);
  }

  @Delete('mandrill')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteMandrill(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteMandrill(Number(accountId));
  }

  @Post('mandrill/test')
  @RequirePermission('account:settings_update')
  async testMandrill(@Param('accountId') accountId: number, @Body() dto: TestAccountMandrillDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testMandrill(dto.apiKey, ip);
  }

  // ── Twilio (WhatsApp Twilio + SMS) ──
  @Get('twilio')
  @RequirePermission('account:settings_view')
  async getTwilio(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getTwilio(Number(accountId));
  }

  @Put('twilio')
  @RequirePermission('account:settings_update')
  async saveTwilio(@Param('accountId') accountId: number, @Body() dto: SaveAccountTwilioDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.saveTwilio(Number(accountId), dto);
  }

  @Delete('twilio')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deleteTwilio(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deleteTwilio(Number(accountId));
  }

  @Post('twilio/test')
  @RequirePermission('account:settings_update')
  async testTwilio(@Param('accountId') accountId: number, @Body() dto: TestAccountTwilioDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testTwilio({ accountSid: dto.accountSid, apiSid: dto.apiSid, apiSecret: dto.apiSecret }, ip);
  }

  // ── Push (Mobile FCM + Web-Push) ──
  @Get('push')
  @RequirePermission('account:settings_view')
  async getPush(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.getPush(Number(accountId));
  }

  @Put('push')
  @RequirePermission('account:settings_update')
  async savePush(@Param('accountId') accountId: number, @Body() dto: SaveAccountPushDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.savePush(Number(accountId), dto);
  }

  @Delete('push')
  @RequirePermission('account:settings_update')
  @HttpCode(204)
  async deletePush(@Param('accountId') accountId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    await this.service.deletePush(Number(accountId));
  }

  @Post('push/test')
  @RequirePermission('account:settings_update')
  async testPush(@Param('accountId') accountId: number, @Body() dto: TestAccountPushDto, @Req() req: any, @IpAddress() ip?: string) {
    this.assertAccountScope(req, Number(accountId));
    return this.service.testPush(dto.firebaseServiceAccount, ip);
  }
}
