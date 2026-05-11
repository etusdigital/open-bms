import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../dtos/pagination.dto';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { UserEntity } from '../../entities/users.entity';
import { UserActivityEntity } from '../../entities/user-activity.entity';
import { PermissionsAccountsDto } from './dtos/permission-accounts.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { PageDto } from '../../dtos/filters/page.dto';
import { AccountsService } from '../accounts/accounts.service';
import { BucketsService } from '../buckets/buckets.service';
import { RoleEntity } from '../../entities/role.entity';
import { ALL_PERMISSION_KEYS, ROLE_CODES, ROLE_PERMISSIONS } from '../authz/authz.constants';
import { AuthzService } from '../authz/authz.service';
import { AUTH_PROVIDER_TOKEN, IAuthProvider } from '../auth/providers/auth.provider.interface';
import { UserRefreshTokenEntity } from '../../entities/user-refresh-token.entity';

const AUTH0_PREFIX = 'auth0|';
const LOCAL_PREFIX = 'local|';

function currentProviderMode(): 'auth0' | 'local' {
  return (process.env.AUTH_PROVIDER || 'local').toLowerCase() === 'auth0' ? 'auth0' : 'local';
}

function assertProviderMatches(providerId: string | undefined | null): void {
  const mode = currentProviderMode();
  const expectedPrefix = mode === 'auth0' ? AUTH0_PREFIX : LOCAL_PREFIX;
  if (!providerId || !providerId.startsWith(expectedPrefix)) {
    const actualPrefix = providerId?.split('|')[0] || 'none';
    throw new BadRequestException(
      `User provider '${actualPrefix}' does not match active provider '${mode}'. ` +
        (mode === 'local' ? 'Reinvite the user to migrate them to the local provider.' : 'Switch AUTH_PROVIDER or reinvite the user.'),
    );
  }
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserAccountEntity)
    private readonly userAccountRepository: Repository<UserAccountEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(UserActivityEntity)
    private readonly userActivityRepository: Repository<UserActivityEntity>,
    @Inject(AUTH_PROVIDER_TOKEN) private readonly authProvider: IAuthProvider,
    private readonly accountService: AccountsService,
    private readonly bucketsService: BucketsService,
    private readonly authzService: AuthzService,
  ) {}

  private async findRoleByCode(roleCode?: string, fallbackRoleCode: string = ROLE_CODES.EDITOR): Promise<RoleEntity> {
    const code = roleCode || fallbackRoleCode;
    let role = await this.roleRepository.findOne({ where: { code } });
    if (!role && code !== fallbackRoleCode) {
      role = await this.roleRepository.findOne({ where: { code: fallbackRoleCode } });
    }
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.BAD_REQUEST);
    }
    return role;
  }

  private getPermissionsByRoleCode(roleCode: string): string[] {
    if (roleCode === ROLE_CODES.SUPER_ADMIN) {
      return [...ALL_PERMISSION_KEYS];
    }

    return [...(ROLE_PERMISSIONS[roleCode] || [])];
  }

  private async resolveAccountOverrideRoleId(roleOverrideCode?: string | null): Promise<number | null> {
    if (!roleOverrideCode) {
      return null;
    }

    if (roleOverrideCode === ROLE_CODES.SUPER_ADMIN) {
      throw new HttpException('Invalid role override', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    return (await this.findRoleByCode(roleOverrideCode, ROLE_CODES.EDITOR)).id;
  }

  async findAll(): Promise<Array<UserEntity>> {
    try {
      return await this.userRepository.find({
        order: {
          name: 'ASC',
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(params: PageDto, userId: number): Promise<PaginationDto<UserEntity>> {
    try {
      const entityManager = this.userRepository.manager;

      const ALLOWED_SORT_FIELDS = ['name', 'email', 'created_at', 'updated_at'];
      const ALLOWED_ORDERS = ['ASC', 'DESC'];
      const sortBy = ALLOWED_SORT_FIELDS.includes(params.sortBy) ? params.sortBy : 'name';
      const order = ALLOWED_ORDERS.includes(params.order?.toUpperCase()) ? params.order.toUpperCase() : 'ASC';

      const queryParams: any[] = [userId];
      let paramIndex = 2;
      let searchFilter = '';

      if (params.search) {
        searchFilter = `AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        queryParams.push(`%${params.search}%`);
        paramIndex++;
      }

      const offset = (params.page - 1) * params.itemsPerPage;
      queryParams.push(offset, params.itemsPerPage);

      const query = `
        SELECT *, count(*) OVER() AS total FROM users WHERE id IN (
          SELECT user_id FROM users_accounts WHERE account_id IN (
            SELECT account_id FROM users_accounts WHERE user_id = $1
            )
          )
          ${searchFilter}
        ORDER BY ${sortBy} ${order}
        OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
      `;

      const results = await entityManager.query(query, queryParams);
      results.forEach((user) => {
        user['createdAt'] = user.created_at;
        user['updatedAt'] = user.updated_at;
        user['providerId'] = user.provider_id;
      });

      return new PaginationDto<UserEntity>({
        results: results,
        total: results.length ? results[0].total : 0,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAllGlobal(params: PageDto): Promise<PaginationDto<UserEntity>> {
    try {
      const ALLOWED_SORT_FIELDS: Record<string, string> = {
        name: 'user.name',
        email: 'user.email',
        created_at: 'user.createdAt',
        updated_at: 'user.updatedAt',
      };
      const sortBy = ALLOWED_SORT_FIELDS[params.sortBy] ?? ALLOWED_SORT_FIELDS.name;
      const order = params.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const qb = this.userRepository
        .createQueryBuilder('user')
        .select(['user.id', 'user.name', 'user.email', 'user.providerId', 'user.profile', 'user.status', 'user.createdAt', 'user.updatedAt'])
        .leftJoinAndSelect('user.globalRole', 'globalRole')
        .loadRelationCountAndMap('user.accountsCount', 'user.userAccount', 'ua', (subQb) => subQb.innerJoin('ua.account', 'a', 'a.deleted_at IS NULL'))
        .orderBy(sortBy, order as 'ASC' | 'DESC')
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage);

      if (params.search) {
        qb.where('user.name ILIKE :search OR user.email ILIKE :search', { search: `%${params.search}%` });
      }

      const [results, total] = await qb.getManyAndCount();

      return new PaginationDto<UserEntity>({
        results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number) {
    try {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.userAccount', 'userAccount')
        .leftJoinAndSelect('userAccount.account', 'account')
        .leftJoinAndSelect('userAccount.roleOverride', 'roleOverride')
        .leftJoinAndSelect('user.globalRole', 'globalRole')
        .where('user.id = :id', { id })
        .getOneOrFail();
      return user;
    } catch (e) {
      console.error(e);
      throw new HttpException('User not found by id', HttpStatus.NOT_FOUND);
    }
  }

  async findOneByProviderId(providerId: string) {
    try {
      return await this.userRepository.findOneOrFail({ where: { providerId } });
    } catch (e) {
      console.error(e);
      throw new HttpException('User not found by provider id', HttpStatus.NOT_FOUND);
    }
  }

  async findOneByMasterId(id: number, masterUserId: number) {
    try {
      const usersMaster = await this.userAccountRepository.createQueryBuilder().where('user_id = :masterUserId AND is_master_user = true', { masterUserId }).getMany();
      const accountIds = usersMaster.map((user) => user.accountId);
      return await this.userRepository
        .createQueryBuilder('users')
        .leftJoinAndSelect('users.userAccount', 'userAccount')
        .leftJoinAndSelect('userAccount.account', 'accounts')
        .where('users.id = :id', { id })
        .andWhere('userAccount.account_id IN (:...accountIds)', { accountIds })
        .getOne();
    } catch (e) {
      console.error(e);
      throw new HttpException('User not found by id', HttpStatus.NOT_FOUND);
    }
  }

  async findOneByEmail(email: string): Promise<UserEntity> {
    try {
      return this.userRepository
        .createQueryBuilder('users')
        .leftJoinAndSelect('users.userAccount', 'userAccount')
        .leftJoinAndSelect('userAccount.account', 'accounts')
        .where('users.email = :email', { email: email.toLowerCase() })
        .getOne();
    } catch (e) {
      console.error(e);
      throw new HttpException('User not found by email', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(userDto: CreateUserDto) {
    try {
      // If a soft-deleted user exists with this email, restore it instead of
      // failing on the email uniqueness constraint. The auth provider already
      // has the user provisioned, so we just clear deleted_at, update the
      // mutable fields, and re-issue the password.
      const existingDeleted = await this.userRepository.findOne({
        where: { email: userDto.email! },
        withDeleted: true,
      });
      if (existingDeleted?.deletedAt) {
        const globalRole = await this.findRoleByCode(userDto.globalRoleCode, ROLE_CODES.EDITOR);
        await this.userRepository.restore(existingDeleted.id);
        await this.userRepository.update(existingDeleted.id, {
          name: userDto.name ?? existingDeleted.name,
          profile: userDto.profile ?? existingDeleted.profile ?? '',
          settings: userDto.settings ?? existingDeleted.settings ?? { language: 'pt-BR' },
          globalRoleId: globalRole.id,
          status: 'pending_invite',
        });
        if (userDto.password && this.authProvider.supportsCredentialLogin()) {
          await this.authProvider.updatePassword(existingDeleted.providerId, userDto.password);
        }
        // users_account has no soft-delete column, so memberships from the prior
        // life of this user are still in the table. Clear them before applying
        // the new account selection so the admin's choice is authoritative
        // instead of a union with whatever access the user had pre-deletion.
        await this.userAccountRepository.delete({ userId: existingDeleted.id });
        if (userDto.accounts && userDto.accounts.length) {
          await this.permissionsAccounts({ userId: existingDeleted.id, accounts: userDto.accounts });
        }
        await this.invalidateCacheForUser(existingDeleted.id);
        return this.findOneById(existingDeleted.id);
      }

      const { providerId } = await this.authProvider.createUser({
        email: userDto.email!,
        name: userDto.name!,
        password: userDto.password,
        picture: userDto.profile,
      });

      const globalRole = await this.findRoleByCode(userDto.globalRoleCode, ROLE_CODES.EDITOR);
      const { password: _password, accounts: _accounts, ...restDto } = userDto;
      const userCreate = this.userRepository.create({
        ...restDto,
        providerId,
        globalRoleId: globalRole.id,
        status: 'pending_invite',
        profile: restDto.profile ?? '',
        settings: restDto.settings ?? { language: 'pt-BR' },
      });
      const user = await this.userRepository.save(userCreate);

      // Local provider mints only the providerId — credentials are persisted here,
      // after the UserEntity row exists (updatePassword looks it up by providerId).
      if (userDto.password && this.authProvider.supportsCredentialLogin()) {
        await this.authProvider.updatePassword(providerId, userDto.password);
      }

      if (userDto.accounts && userDto.accounts.length) {
        await this.permissionsAccounts({ userId: user.id, accounts: userDto.accounts });
      }

      return this.findOneById(user.id);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error(e);
      if ((e as any)?.code === '23505') {
        throw new HttpException((e as any).detail || 'User already exists', HttpStatus.CONFLICT);
      }
      throw new HttpException((e as Error)?.message || 'Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async invite(userDto: CreateUserDto) {
    return this.create(userDto);
  }

  async updateProfile(providerId: string, profileDto: { name?: string; email?: string; profile?: string; settings?: Record<string, string> }): Promise<UserEntity> {
    const user = await this.findOneByProviderId(providerId);

    if (profileDto.name !== undefined) user.name = profileDto.name;
    if (profileDto.email !== undefined) user.email = profileDto.email;
    if (profileDto.profile !== undefined) user.profile = profileDto.profile;
    if (profileDto.settings !== undefined) user.settings = profileDto.settings;

    delete user['userAccount'];
    await this.userRepository.update(user.id, user);

    const providerFields = ['name', 'email', 'profile'];
    const hasProviderChanges = providerFields.some((field) => profileDto[field] !== undefined);
    if (hasProviderChanges) {
      await this.authProvider.updateUser(user.providerId, {
        name: profileDto.name,
        email: profileDto.email,
        picture: profileDto.profile,
      });
    }

    return user;
  }

  async uploadProfilePicture(providerId: string, uploadBody: { name: string; data: string }): Promise<UserEntity> {
    const user = await this.findOneByProviderId(providerId);

    const result = await this.bucketsService.genericUpload({
      name: uploadBody.name,
      data: uploadBody.data,
      pathFolderName: `users/${user.id}/profile`,
      isPublic: true,
    });

    user.profile = result.link;
    delete user['userAccount'];
    await this.userRepository.update(user.id, user);

    await this.authProvider.updateUser(user.providerId, { picture: result.link });

    return user;
  }

  async update(id: number, userDto: CreateUserDto, userMasterId: number): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (userDto.globalRoleCode) {
        const globalRole = await this.findRoleByCode(userDto.globalRoleCode, ROLE_CODES.EDITOR);
        user.globalRoleId = globalRole.id;
      }

      this.userRepository.merge(user, userDto);
      delete user['userAccount'];
      await this.userRepository.update(id, user);

      if (userDto.accounts) {
        await this.permissionsAccounts({ userId: user.id, accounts: userDto.accounts, userMasterId });
      }

      const providerFields = ['name', 'email', 'profile'];
      const hasProviderChanges = providerFields.some((field) => userDto[field] !== undefined);
      if (hasProviderChanges) {
        await this.authProvider.updateUser(user.providerId, {
          name: userDto.name,
          email: userDto.email,
          picture: userDto.profile,
        });
      }

      if (userDto.globalRoleCode || userDto.accounts) {
        await this.invalidateCacheForUser(user.id);
      }

      return user;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async invalidateCacheForUser(userId: number): Promise<void> {
    const user = await this.userRepository.createQueryBuilder('user').select(['user.providerId']).where('user.id = :id', { id: userId }).getOne();
    if (user?.providerId) {
      await this.authzService.invalidateUserCache(user.providerId);
    }
  }

  async updateGlobalRole(id: number, roleCode: string): Promise<UserEntity> {
    const role = await this.findRoleByCode(roleCode, ROLE_CODES.EDITOR);
    await this.userRepository.update(id, { globalRoleId: role.id });
    await this.invalidateCacheForUser(id);
    return this.findOneById(id);
  }

  async addAccountMembership(userId: number, accountId: number, roleOverrideCode?: string | null) {
    const overrideRoleId = await this.resolveAccountOverrideRoleId(roleOverrideCode);

    await this.userAccountRepository
      .createQueryBuilder('users_accounts')
      .insert()
      .into('users_accounts')
      .values([{ userId, accountId, isMasterUser: false, roleOverrideRoleId: overrideRoleId }])
      .orUpdate(['is_master_user', 'role_override_role_id'], ['account_id', 'user_id'])
      .execute();

    await this.invalidateCacheForUser(userId);
    return this.userAccountRepository.find({ where: { userId, accountId } });
  }

  async updateAccountRole(userId: number, accountId: number, roleOverrideCode?: string | null) {
    const membership = await this.userAccountRepository.findOne({ where: { userId, accountId } });
    if (!membership) {
      throw new ForbiddenException('User does not belong to account');
    }

    const overrideRoleId = await this.resolveAccountOverrideRoleId(roleOverrideCode);
    await this.userAccountRepository
      .createQueryBuilder('users_accounts')
      .update('users_accounts')
      .set({ roleOverrideRoleId: overrideRoleId })
      .where('user_id = :userId AND account_id = :accountId', { userId, accountId })
      .execute();

    await this.invalidateCacheForUser(userId);
    return this.userAccountRepository.find({ where: { userId, accountId } });
  }

  async removeAccountMembership(userId: number, accountId: number) {
    const membership = await this.userAccountRepository.findOne({ where: { userId, accountId } });
    if (!membership) {
      throw new ForbiddenException('User does not belong to account');
    }

    await this.userAccountRepository
      .createQueryBuilder('users_accounts')
      .delete()
      .from('users_accounts')
      .where('user_id = :userId AND account_id = :accountId', { userId, accountId })
      .execute();

    await this.invalidateCacheForUser(userId);
    return { removed: true };
  }

  async softDeleteUser(targetUserId: number, actingUserId: number | undefined): Promise<{ deleted: true }> {
    if (actingUserId !== undefined && Number(targetUserId) === Number(actingUserId)) {
      throw new ForbiddenException('You cannot delete your own user');
    }
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    await this.userRepository.softDelete(targetUserId);
    // Revoke active refresh tokens so a deleted user can't keep rotating sessions
    // until natural expiry. Access JWTs themselves are still valid until their TTL,
    // but without a refresh token they expire on their own within minutes.
    await this.userRepository.manager
      .createQueryBuilder()
      .update(UserRefreshTokenEntity)
      .set({ revokedAt: () => 'NOW()' })
      .where('userId = :id AND revokedAt IS NULL', { id: targetUserId })
      .execute();
    await this.invalidateCacheForUser(targetUserId);
    return { deleted: true };
  }

  async updateMyPassword(providerId: string, password: string): Promise<UserEntity> {
    const user = await this.findOneByProviderId(providerId);
    assertProviderMatches(user.providerId);
    await this.authProvider.updatePassword(user.providerId, password);
    return user;
  }

  async updatePassword(id: number, userDto: CreateUserDto): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) return user;
      assertProviderMatches(user.providerId);
      await this.authProvider.updatePassword(user.providerId, userDto.password!);
      return user;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async login(providerId: string) {
    try {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .select(['user.id', 'user.name', 'user.email', 'user.profile', 'user.providerId', 'user.settings', 'user.status', 'user.createdAt'])
        .where('user.provider_id = :providerId', { providerId })
        .andWhere('user.deleted_at IS NULL')
        .getOne();

      if (!user) {
        throw new HttpException('User not found. Please contact an administrator to get access.', HttpStatus.FORBIDDEN);
      }

      return user;
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async validateJwtFromRequest(req: any): Promise<{ sub: string }> {
    const authHeader = req.headers?.['authorization'] as string;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('Missing or invalid Authorization header', HttpStatus.UNAUTHORIZED);
    }
    const token = authHeader.substring(7);
    const payload = await this.authProvider.verifyToken(token);
    return { sub: payload.sub };
  }

  async getMe(providerId: string, accountId?: number) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.globalRole', 'globalRole')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.profile',
        'user.providerId',
        'user.settings',
        'user.status',
        'user.globalRoleId',
        'user.createdAt',
        'globalRole.id',
        'globalRole.code',
        'globalRole.name',
      ])
      .where('user.provider_id = :providerId', { providerId })
      .andWhere('user.deleted_at IS NULL')
      .getOne();

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const globalRole = user.globalRole || (await this.findRoleByCode(undefined, ROLE_CODES.EDITOR));
    const globalRoleCode = globalRole.code;

    const lightAccount = (account: any) => ({
      id: account.id,
      name: account.name,
      isInternal: account.isInternal,
      isActive: account.isActive,
    });

    let membershipSource: any[];
    const numericAccountId = accountId ? Number(accountId) : undefined;

    if (globalRoleCode === ROLE_CODES.SUPER_ADMIN) {
      const accounts = await this.accountService.getAllAccountsLightweight();
      membershipSource = accounts.map((account) => ({
        userId: user.id,
        accountId: account.id,
        isMasterUser: true,
        roleOverrideRoleId: null,
        account: lightAccount(account),
        roleOverride: null,
      }));
    } else {
      const memberships = await this.userAccountRepository
        .createQueryBuilder('ua')
        .innerJoinAndSelect('ua.account', 'account', 'account.deleted_at IS NULL')
        .leftJoin('ua.roleOverride', 'role')
        .select(['ua.userId', 'ua.accountId', 'ua.isMasterUser', 'ua.roleOverrideRoleId', 'account.id', 'account.name', 'account.isInternal', 'account.isActive', 'role.code'])
        .where('ua.userId = :userId', { userId: user.id })
        .getMany();
      membershipSource = memberships.map((m) => ({
        userId: m.userId,
        accountId: m.accountId,
        isMasterUser: m.isMasterUser,
        roleOverrideRoleId: m.roleOverrideRoleId,
        account: m.account ? lightAccount(m.account) : null,
        roleOverride: m.roleOverride?.code || null,
      }));
    }

    const selectedMembership = numericAccountId ? membershipSource.find((item) => item.accountId === numericAccountId) : membershipSource[0];

    if (!selectedMembership && globalRoleCode !== ROLE_CODES.SUPER_ADMIN) {
      throw new ForbiddenException('User has no account membership');
    }

    const effectiveRoleCode = selectedMembership?.roleOverride || globalRoleCode;
    const permissions = this.getPermissionsByRoleCode(effectiveRoleCode);
    const isSuperAdmin = globalRoleCode === ROLE_CODES.SUPER_ADMIN;

    const roles: string[] = [];
    if (isSuperAdmin) roles.push(ROLE_CODES.SUPER_ADMIN);
    if (effectiveRoleCode && !roles.includes(effectiveRoleCode)) roles.push(effectiveRoleCode);

    const canSeeAllAccounts = isSuperAdmin || effectiveRoleCode === 'billing';

    return {
      ...user,
      globalRole: globalRoleCode,
      effectiveRole: effectiveRoleCode,
      permissions,
      roles,
      isSuperAdmin,
      canSeeAllAccounts,
      userAccount: membershipSource.map((membership) => ({
        ...membership,
        roleOverride: membership.roleOverride || null,
        inheritsGlobal: !membership.roleOverrideRoleId,
      })),
    };
  }

  async isUserMaster(userMasterId: number, accountId: number): Promise<UserAccountEntity[]> {
    try {
      const isMaster = await this.userAccountRepository.find({
        where: {
          accountId: accountId,
          userId: userMasterId,
        },
        select: ['isMasterUser'],
      });

      return isMaster;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async permissionsAccounts(permissionsAccountsDto: PermissionsAccountsDto) {
    try {
      const usersAccounts = [];
      for (const item of permissionsAccountsDto.accounts) {
        const roleOverrideRoleId = await this.resolveAccountOverrideRoleId(item.roleOverrideCode);
        usersAccounts.push({ userId: permissionsAccountsDto.userId, accountId: item.accountId, isMasterUser: item.isMasterUser, roleOverrideRoleId });
      }

      if (permissionsAccountsDto.userMasterId) {
        const userMaster = await this.userAccountRepository
          .createQueryBuilder('users_accounts')
          .select('account_id')
          .where(`user_id = ${permissionsAccountsDto.userMasterId} AND is_master_user = ${true}`)
          .execute();

        const accounts_id = userMaster.map((account) => {
          return account.account_id;
        });

        if (accounts_id.length) {
          await this.userAccountRepository
            .createQueryBuilder('users_accounts')
            .delete()
            .from('users_accounts')
            .where(`users_accounts.user_id = :id and users_accounts.account_id IN (:...accounts_id)`, {
              id: permissionsAccountsDto.userId,
              accounts_id,
            })
            .execute();
        }
      }

      await this.userAccountRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(UserAccountEntity);
        for (const ua of usersAccounts) {
          const existing = await repo.findOne({
            where: { userId: ua.userId, accountId: ua.accountId },
          });
          if (existing) {
            existing.isMasterUser = ua.isMasterUser;
            existing.roleOverrideRoleId = ua.roleOverrideRoleId;
            await repo.save(existing);
          } else {
            await repo.save(repo.create(ua));
          }
        }
      });

      await this.invalidateCacheForUser(permissionsAccountsDto.userId);
    } catch (e) {
      console.error(e);
      throw new HttpException('Cannot permission accounts to user', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listRoles() {
    return this.roleRepository.find({ where: { isActive: true }, order: { id: 'ASC' } });
  }

  async logActivity(data: {
    userId: number | null;
    email: string;
    action: string;
    status: 'success' | 'failed';
    ipAddress: string | null;
    userAgent: string | null;
    headers: Record<string, string> | null;
  }): Promise<void> {
    await this.userActivityRepository.save(this.userActivityRepository.create(data));
  }
}
