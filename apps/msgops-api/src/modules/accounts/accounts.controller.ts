import { BadRequestException, Body, ClassSerializerInterceptor, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, UseInterceptors, Req } from '@nestjs/common';
import { PageDto } from '../../dtos/filters/page.dto';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dtos/create-account.dto';
import { ApiKeyRegenService } from './api-key-regen.service';
import { RequestRegenDto, ConfirmRegenDto } from './dtos/api-key-regen.dto';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly apiKeyRegenService: ApiKeyRegenService,
  ) {}

  private assertAccountScope(req: any, accountId: number) {
    const context = req?.authzContext;
    if (!context) {
      throw new ForbiddenException('Authentication context required');
    }

    if (context.isSuperAdmin) {
      return;
    }

    if (context.accountId && Number(context.accountId) !== Number(accountId)) {
      throw new ForbiddenException('Principal cannot access this account');
    }
  }

  private requireSuperAdmin(req: any) {
    const context = req?.authzContext;
    if (!context?.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  @Post()
  create(@Body() accountDto: CreateAccountDto, @Req() req: any) {
    this.requireSuperAdmin(req);
    const userId = req?.authzContext?.userId || req?.user?.id || 0;
    return this.accountsService.create(accountDto, userId);
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get()
  findAll(@Query() params: PageDto, @Req() req: any) {
    const userId = req?.authzContext?.userId || req?.user?.id || 0;

    if (!params.itemsPerPage) {
      return this.accountsService.findAll(userId);
    }

    return this.accountsService.listPaginated(params, userId);
  }

  @Get('/all')
  getAllAccounts(@Req() req: any) {
    this.requireSuperAdmin(req);
    return this.accountsService.getAllAccounts();
  }

  @Get('/configs')
  getConfigs(@Req() req: any) {
    const context = req?.authzContext;
    if (!context) {
      throw new ForbiddenException('Authentication context required');
    }
    if (!context.accountId) {
      throw new ForbiddenException('Account context required');
    }
    return this.accountsService.getConfigs(Number(context.accountId));
  }

  @RequirePermission('account:settings_view')
  @UseInterceptors(ClassSerializerInterceptor)
  @Get(':id')
  findOne(@Param('id') id: number, @Req() req: any) {
    this.assertAccountScope(req, Number(id));
    return this.accountsService.findOne(Number(id));
  }

  @RequirePermission('account:settings_update')
  @Put(':id')
  update(@Param('id') id: number, @Body() accountDto: CreateAccountDto, @Req() req: any) {
    this.assertAccountScope(req, Number(id));
    return this.accountsService.update(Number(id), accountDto);
  }

  @RequirePermission('account:settings_update')
  @Put('/providers/:id')
  updateProviders(@Param('id') id: number, @Body() accountDto: any, @Req() req: any) {
    this.assertAccountScope(req, Number(id));
    return this.accountsService.createOrUpdateAccountsConfigs(Number(id), accountDto);
  }

  @Get('/:accountId/api-keys')
  @RequirePermission('account:api_keys_view')
  listManagedApiKeys(@Param('accountId') accountId: number, @Query() params: PageDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.accountsService.listManagedApiKeys(Number(accountId), params);
  }

  @Post('/:accountId/api-keys')
  @RequirePermission('account:api_keys_create')
  createManagedApiKey(@Param('accountId') accountId: number, @Body() payload: { name?: string; roleCode?: string; expiresAt?: Date }, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.accountsService.createManagedApiKey(Number(accountId), payload, req?.authzContext?.userId || null);
  }

  @Put('/:accountId/api-keys/:keyId')
  @RequirePermission('account:api_keys_update_role')
  updateManagedApiKey(
    @Param('accountId') accountId: number,
    @Param('keyId') keyId: number,
    @Body() payload: { name?: string; roleCode?: string; expiresAt?: Date | null },
    @Req() req: any,
  ) {
    this.assertAccountScope(req, Number(accountId));
    return this.accountsService.updateManagedApiKey(Number(accountId), Number(keyId), payload);
  }

  @Post('/:accountId/api-keys/:keyId/rotate')
  @RequirePermission('account:api_keys_rotate')
  rotateManagedApiKey(@Param('accountId') accountId: number, @Param('keyId') keyId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.accountsService.rotateManagedApiKey(Number(accountId), Number(keyId));
  }

  @Post('/:accountId/api-keys/:keyId/revoke')
  @RequirePermission('account:api_keys_revoke')
  revokeManagedApiKey(@Param('accountId') accountId: number, @Param('keyId') keyId: number, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.accountsService.revokeManagedApiKey(Number(accountId), Number(keyId));
  }

  @RequirePermission('account:api_keys_view')
  @Get('/api-keys/:id')
  getApiKeysByAccount(@Param('id') accountId: number, @Query() params: PageDto, @Req() req: any) {
    this.assertAccountScope(req, Number(accountId));
    return this.accountsService.getApiKeysByAccount(Number(accountId), params);
  }

  @RequirePermission('account:api_keys_revoke')
  @Delete('/api-keys')
  deleteApiKeyByAcoount(@Query() params: any, @Req() req: any) {
    if (!params.accountId) {
      throw new BadRequestException('accountId query parameter is required');
    }
    this.assertAccountScope(req, Number(params.accountId));
    return this.accountsService.deleteApiKeyByAccount(params);
  }

  @RequirePermission('account:api_keys_rotate')
  @Post(':id/api-keys/request-regen')
  async requestApiKeyRegen(@Param('id') id: number, @Body() dto: RequestRegenDto, @Req() req: any) {
    this.assertAccountScope(req, Number(id));
    const meta = this.extractRequestMeta(req);
    await this.apiKeyRegenService.requestRegeneration(id, dto.keyType, meta.userEmail, meta.userName, meta, dto.expiresAt);
    return { message: 'Confirmation email sent' };
  }

  @RequirePermission('account:api_keys_rotate')
  @Post(':id/api-keys/confirm-regen')
  async confirmApiKeyRegen(@Param('id') id: number, @Body() dto: ConfirmRegenDto, @Req() req: any) {
    this.assertAccountScope(req, Number(id));
    const meta = this.extractRequestMeta(req);
    return this.apiKeyRegenService.confirmRegeneration(id, dto.keyType, dto.token, meta);
  }

  private extractRequestMeta(req: any) {
    const context = req?.authzContext;
    let userEmail = '';
    let userName = '';

    // Try authzContext first, then fall back to Current-User header
    try {
      const currentUser = req.headers['current-user'];
      if (currentUser) {
        const parsed = JSON.parse(currentUser);
        userEmail = parsed.email || '';
        userName = parsed.name || '';
      }
    } catch {
      // Malformed Current-User header — proceed with empty values
    }

    return {
      userId: context?.userId || 0,
      userEmail,
      userName,
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @RequirePermission('account:api_keys_view')
  @Get(':id/api-keys/status')
  async getApiKeysStatus(@Param('id') id: number, @Req() req: any) {
    this.assertAccountScope(req, Number(id));
    return this.apiKeyRegenService.getKeyStatus(id);
  }

  @Delete(':id')
  remove(@Param('id') id: number, @Req() req: any) {
    this.requireSuperAdmin(req);
    return this.accountsService.destroy(Number(id));
  }

  @RequirePermission('account:settings_view')
  @Get('/config/:name')
  findConfig(@Param('name') name: string) {
    return this.accountsService.findConfig(name);
  }

  @RequirePermission('account:settings_update')
  @Put('/config/:name')
  updateConfig(@Param('name') name: string, @Body() config: any) {
    return this.accountsService.updateAccountConfig(name, config);
  }
}
