import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from '../../dtos/pagination.dto';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { UserEntity } from '../../entities/users.entity';
import { UserActivityEntity } from '../../entities/user-activity.entity';
import { Repository } from 'typeorm';
import { PermissionsAccountsDto } from './dtos/permission-accounts.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { Auth0Provider } from '../../providers/auth0.provider';
import { PageDto } from '../../dtos/filters/page.dto';
import { AccountsService } from '../accounts/accounts.service';
import { BucketsService } from '../buckets/buckets.service';
import { RoleEntity } from '../../entities/role.entity';
import { ALL_PERMISSION_KEYS, ROLE_CODES, ROLE_PERMISSIONS } from '../authz/authz.constants';
import { AuthzService } from '../authz/authz.service';

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
    private readonly auth0: Auth0Provider,
    private readonly accountService: AccountsService,
    private readonly bucketsService: BucketsService,
    private readonly authzService: AuthzService,
  ) {}

  private readonly jwks = jwksClient({
    jwksUri: process.env.JWKS_URI || '',
    cache: true,
    cacheMaxEntries: 10,
    cacheMaxAge: 600000,
  });

  async validateJwtFromRequest(req: any): Promise<{ sub: string }> {
    const authHeader = req.headers?.['authorization'] as string;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const decoded: any = jwt.decode(token, { complete: true });
      if (!decoded?.header?.kid) {
        throw new UnauthorizedException('Invalid token');
      }

      const signingKey = await new Promise<string>((resolve, reject) => {
        this.jwks.getSigningKey(decoded.header.kid, (err, key: any) => {
          if (err || !key) {
            reject(err || new Error('Signing key not found'));
            return;
          }
          resolve(key.getPublicKey ? key.getPublicKey() : key.publicKey || key.rsaPublicKey);
        });
      });

      const payload = jwt.verify(token, signingKey, {
        audience: process.env.IDP_AUDIENCE,
        issuer: process.env.IDP_ISSUER,
        algorithms: ['RS256'],
      }) as any;

      return { sub: payload.sub };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

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

  async findOneById(id: number) {
    try {
      return await this.userRepository.findOneOrFail({ where: { id } });
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
      const userAuth0 = await this.auth0.createNewUser(userDto);

      if (userAuth0) {
        const globalRole = await this.findRoleByCode(userDto.globalRoleCode, ROLE_CODES.EDITOR);
        userDto.profile = userAuth0.picture;
        const userCreate = await this.userRepository.create({
          ...userDto,
          providerId: userAuth0.user_id,
          globalRoleId: globalRole.id,
          status: 'pending_invite',
        });
        const user = await this.userRepository.save(userCreate);

        if (userDto.accounts && userDto.accounts.length) {
          await this.permissionsAccounts({ userId: user.id, accounts: userDto.accounts });
        }

        return this.findOneById(user.id);
      }

      throw new HttpException('Failed to create user in Auth0', HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async invite(userDto: CreateUserDto) {
    return this.create(userDto);
  }

  async updateProfile(providerId: string, profileDto: { name?: string; email?: string; profile?: string; settings?: Record<string, string> }): Promise<UserEntity> {
    const user = await this.findOneByProviderId(providerId);
    const isDatabaseConnection = user.providerId?.startsWith('auth0|');

    if (profileDto.name !== undefined) user.name = profileDto.name;
    if (profileDto.email !== undefined) user.email = profileDto.email;
    if (profileDto.profile !== undefined) user.profile = profileDto.profile;
    if (profileDto.settings !== undefined) user.settings = profileDto.settings;

    delete user['userAccount'];
    await this.userRepository.update(user.id, user);

    if (isDatabaseConnection) {
      const auth0Fields = ['name', 'email', 'profile'];
      const hasAuth0Changes = auth0Fields.some((field) => profileDto[field] !== undefined);
      if (hasAuth0Changes) {
        await this.auth0.updateUser({ provider_id: user.providerId, ...profileDto });
      }
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

    const isDatabaseConnection = user.providerId?.startsWith('auth0|');
    if (isDatabaseConnection) {
      await this.auth0.updateUser({ provider_id: user.providerId, profile: result.link });
    }

    return user;
  }

  async update(id: number, userDto: CreateUserDto, userMasterId: number): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const isDatabaseConnection = user.providerId?.startsWith('auth0|');

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

      if (isDatabaseConnection) {
        const auth0Fields = ['name', 'email', 'profile'];
        const hasAuth0Changes = auth0Fields.some((field) => userDto[field] !== undefined);
        if (hasAuth0Changes) {
          await this.auth0.updateUser({ provider_id: user.providerId, ...userDto });
        }
      }

      return user;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateGlobalRole(id: number, roleCode: string): Promise<UserEntity> {
    const role = await this.findRoleByCode(roleCode, ROLE_CODES.EDITOR);
    await this.userRepository.update(id, { globalRoleId: role.id });
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

    return { removed: true };
  }

  async updateMyPassword(providerId: string, password: string): Promise<UserEntity> {
    const user = await this.findOneByProviderId(providerId);

    if (!user.providerId?.startsWith('auth0|')) {
      throw new HttpException('Password update is only available for email/password accounts', HttpStatus.BAD_REQUEST);
    }

    await this.auth0.updateUserPassword(user.providerId, password);
    return user;
  }

  async updatePassword(id: number, userDto: CreateUserDto): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (user) {
        if (!user.providerId?.startsWith('auth0|')) {
          throw new HttpException('Password update is only available for email/password accounts', HttpStatus.BAD_REQUEST);
        }
        await this.auth0.updateUserPassword(user.providerId, userDto.password);
      }

      return user;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async login(providerId: string) {
    try {
      // Minimal query — just verify user exists, no relations needed
      // All account/permission data is loaded via GET /users/me
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

  async getMe(providerId: string, accountId?: number) {
    // Lightweight user query — skip eager relations (userAccount, account, configs)
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

    // Lightweight account query — only fields the frontend needs for account switcher
    const lightAccount = (account: any) => ({
      id: account.id,
      name: account.name,
      isInternal: account.isInternal,
      isActive: account.isActive,
    });

    let membershipSource: any[];
    const numericAccountId = accountId ? Number(accountId) : undefined;

    if (globalRoleCode === ROLE_CODES.SUPER_ADMIN) {
      // Lightweight query — only 4 columns, no eager relations
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
      // Lightweight query — skip eager customFields/accountConfigs
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

    return {
      ...user,
      globalRole: globalRoleCode,
      effectiveRole: effectiveRoleCode,
      permissions,
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

      return await this.userAccountRepository
        .createQueryBuilder('users_accounts')
        .insert()
        .into('users_accounts')
        .values(usersAccounts)
        .orUpdate(['is_master_user', 'role_override_role_id'], ['account_id', 'user_id'])
        .execute();
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
