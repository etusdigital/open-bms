import { Body, Controller, Delete, ForbiddenException, Get, HttpException, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { PublicRoute } from '../authz/public-route.decorator';
import { RequirePermission } from '../authz/require-permission.decorator';
import { PageDto } from '../../dtos/filters/page.dto';
import { Auth0Dto } from './dtos/auth0.dto';
import { PermissionsAccountsDto } from './dtos/permission-accounts.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly authService: AuthService,
  ) {}

  private requireSuperAdmin(req: any) {
    const context = req?.authzContext;
    if (!context?.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private getProviderId(authUser: any): string {
    return authUser?.sub || authUser?.user_id || authUser?.provider_id;
  }

  @Post('/login')
  @PublicRoute()
  async login(@Body() body: Partial<Auth0Dto>, @Req() req: any) {
    // Short-circuit before DTO validation runs — in local mode this endpoint is retired.
    if ((process.env.AUTH_PROVIDER || 'local').toLowerCase() !== 'auth0') {
      throw new HttpException('This endpoint is deprecated under AUTH_PROVIDER=local. Use POST /auth/login.', HttpStatus.GONE);
    }

    const auth0Dto = body as Auth0Dto;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    const headers = req.headers as Record<string, string>;

    const { sub } = await this.userService.validateJwtFromRequest(req);

    let userId: number | null = null;
    let status: 'success' | 'failed' = 'failed';

    try {
      const user = await this.userService.login(sub);
      userId = user?.id ?? null;
      status = 'success';
      return user;
    } finally {
      this.userService.logActivity({ userId, email: auth0Dto.email, action: 'login', status, ipAddress, userAgent, headers }).catch(() => null);
    }
  }

  @Get('/me')
  me(@AuthUser() authUser: any, @Query('accountId') accountId?: number) {
    const providerId = this.getProviderId(authUser);
    return this.userService.getMe(providerId, accountId);
  }

  @Put('/me')
  updateMe(@Body() profileDto: UpdateProfileDto, @AuthUser() authUser: any) {
    const providerId = this.getProviderId(authUser);
    return this.userService.updateProfile(providerId, profileDto);
  }

  @Put('/me/password')
  updateMyPassword(@Body('password') password: string, @AuthUser() authUser: any) {
    const providerId = this.getProviderId(authUser);
    return this.userService.updateMyPassword(providerId, password);
  }

  @Post('/me/profile-picture')
  uploadProfilePicture(@Body() uploadBody: { name: string; data: string }, @AuthUser() authUser: any) {
    const providerId = this.getProviderId(authUser);
    return this.userService.uploadProfilePicture(providerId, uploadBody);
  }

  @Get('/all')
  async findAllGlobal(@Query() params: PageDto, @Req() req: any) {
    this.requireSuperAdmin(req);
    return this.userService.findAllGlobal(params);
  }

  @Post(':id/reset-password')
  async requestPasswordReset(@Param('id') id: number, @Req() req: any) {
    this.requireSuperAdmin(req);
    return this.authService.requestPasswordReset(Number(id));
  }

  @Get('/roles')
  @RequirePermission('account:roles_view')
  listRoles() {
    return this.userService.listRoles();
  }

  @Post('/invite')
  @RequirePermission('account:users_invite')
  invite(@Body() createDto: CreateUserDto, @Req() req: any) {
    return this.userService.invite(createDto, { isSuperAdmin: req?.authzContext?.isSuperAdmin === true });
  }

  @Post()
  @RequirePermission('account:users_invite')
  async create(@Body() createDto: CreateUserDto, @Req() req: any) {
    return await this.userService.create(createDto, { isSuperAdmin: req?.authzContext?.isSuperAdmin === true });
  }

  @Get()
  @RequirePermission('account:users_view')
  async findAll(@Query() params: PageDto, @AuthUser() authUser: any, @Req() req: any) {
    const providerId = this.getProviderId(authUser);
    const currentUser = await this.userService.findOneByProviderId(providerId);

    if (!params.itemsPerPage) {
      return this.userService.findAll();
    }

    // Pass the requester's active account (resolved server-side) so the list is
    // scoped strictly to it and each row carries its account role override (F2/F12).
    const activeAccountId = req?.authzContext?.accountId as number | undefined;
    return this.userService.listPaginated(params, currentUser.id, activeAccountId);
  }

  @Get('/master')
  @RequirePermission('account:users_view')
  async isUserMaster(@AuthUser() authUser: any, @Query('accountId') accountId: number) {
    const providerId = this.getProviderId(authUser);
    const currentUser = await this.userService.findOneByProviderId(providerId);
    return this.userService.isUserMaster(currentUser.id, Number(accountId));
  }

  @Get(':id')
  @RequirePermission('account:users_view')
  async findOne(@Param('id') id: number, @AuthUser() authUser: any, @Req() req: any) {
    const providerId = this.getProviderId(authUser);
    const currentUser = await this.userService.findOneByProviderId(providerId);

    // super_admin bypasses scoping: orphan users (no userAccount rows) are invisible to scoped fetches.
    const isSuperAdmin = req?.authzContext?.isSuperAdmin === true;
    if (!isSuperAdmin && currentUser.id !== Number(id)) {
      // Account-scoped fetch (F1): an account admin (isMasterUser=false) must be able to
      // load a user who shares their account. Scope by membership, not by master-id.
      const activeAccountId = req?.authzContext?.accountId as number | undefined;
      return this.userService.findOneInAccountScope(Number(id), currentUser.id, activeAccountId);
    }

    return this.userService.findOneById(Number(id));
  }

  @Post('/permissions')
  @RequirePermission('account:users_update_roles')
  permissionsAccounts(@Body() permissionsAccountsDto: PermissionsAccountsDto) {
    return this.userService.permissionsAccounts(permissionsAccountsDto);
  }

  @Put(':id')
  @RequirePermission('account:users_update_roles')
  async update(@Param('id') id: number, @Body() userDto: CreateUserDto, @AuthUser() authUser: any, @Req() req: any) {
    const providerId = this.getProviderId(authUser);
    const currentUser = await this.userService.findOneByProviderId(providerId);
    return this.userService.update(Number(id), userDto, currentUser.id, { isSuperAdmin: req?.authzContext?.isSuperAdmin === true });
  }

  @Put('/update-password/:id')
  @RequirePermission('account:users_update_roles')
  updatePassword(@Param('id') id: number, @Body() userDto: CreateUserDto) {
    return this.userService.updatePassword(Number(id), userDto);
  }

  @Put(':id/global-role')
  @RequirePermission('account:users_update_roles')
  updateGlobalRole(@Param('id') id: number, @Body('globalRoleCode') globalRoleCode: string) {
    return this.userService.updateGlobalRole(Number(id), globalRoleCode);
  }

  @Post(':id/accounts')
  @RequirePermission('account:users_update_roles')
  addAccountMembership(@Param('id') id: number, @Body('accountId') accountId: number, @Body('roleOverrideCode') roleOverrideCode?: string | null) {
    return this.userService.addAccountMembership(Number(id), Number(accountId), roleOverrideCode);
  }

  @Put(':id/accounts/:accountId/role')
  @RequirePermission('account:users_update_roles')
  updateAccountRole(@Param('id') id: number, @Param('accountId') accountId: number, @Req() req: any, @Body('roleOverrideCode') roleOverrideCode?: string | null) {
    return this.userService.updateAccountRole(Number(id), Number(accountId), roleOverrideCode, {
      userId: req?.authzContext?.userId,
      isSuperAdmin: req?.authzContext?.isSuperAdmin === true,
    });
  }

  @Delete(':id/accounts/:accountId')
  @RequirePermission('account:users_update_roles')
  removeAccountMembership(@Param('id') id: number, @Param('accountId') accountId: number, @Req() req: any) {
    return this.userService.removeAccountMembership(Number(id), Number(accountId), {
      userId: req?.authzContext?.userId,
      isSuperAdmin: req?.authzContext?.isSuperAdmin === true,
    });
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: number, @Req() req: any) {
    this.requireSuperAdmin(req);
    const actingUserId = req?.authzContext?.userId;
    return this.userService.softDeleteUser(Number(id), actingUserId);
  }
}
