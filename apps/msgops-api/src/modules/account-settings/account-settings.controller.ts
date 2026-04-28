import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AccountSettingsService } from './account-settings.service';
import { SaveAccountSendgridDto, TestAccountSendgridDto } from './dtos/sendgrid.dto';

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
}
