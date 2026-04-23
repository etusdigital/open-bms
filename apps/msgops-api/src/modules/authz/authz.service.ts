import { ForbiddenException, Inject, Injectable, UnauthorizedException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AccountApiKeyEntity } from '../../entities/account-api-key.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { RoleEntity } from '../../entities/role.entity';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { UserEntity } from '../../entities/users.entity';
import { RedisService } from '../../providers/redis.provider';
import { ALL_PERMISSION_KEYS, ROLE_CODES, ROLE_PERMISSIONS } from './authz.constants';
import { PrincipalContext } from './authz.types';
import { AUTH_PROVIDER_TOKEN, IAuthProvider } from '../auth/providers/auth.provider.interface';

const AUTHZ_CACHE_TTL = 300; // 5 minutes

@Injectable()
export class AuthzService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserAccountEntity)
    private readonly userAccountRepository: Repository<UserAccountEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => AUTH_PROVIDER_TOKEN))
    private readonly authProvider: IAuthProvider,
  ) {}

  private async getCachedPrincipal(cacheKey: string): Promise<PrincipalContext | null> {
    try {
      const cached = await this.redisService.getClient().get(cacheKey);
      return cached ? (JSON.parse(cached) as PrincipalContext) : null;
    } catch {
      return null;
    }
  }

  private async cachePrincipal(cacheKey: string, context: PrincipalContext): Promise<void> {
    try {
      await this.redisService.getClient().set(cacheKey, JSON.stringify(context), 'EX', AUTHZ_CACHE_TTL);
    } catch {
      // Non-blocking
    }
  }

  async invalidateUserCache(providerId: string): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const keys = await redis.keys(`authz:user:${providerId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Non-blocking
    }
  }

  private hashApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  private getHeaderApiKey(req: any): string | null {
    return req?.headers?.['api-key'] || req?.headers?.['x-api-key'] || null;
  }

  private getHeaderAccountId(req: any): number | undefined {
    const raw = req?.headers?.['account-id'];
    const parsed = raw ? Number(raw) : undefined;
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async verifyJwtToken(token: string): Promise<any> {
    return this.authProvider.verifyToken(token);
  }

  private async resolveUserContext(payload: any, requestedAccountId?: number): Promise<PrincipalContext> {
    const providerId = payload?.sub || payload?.user_id || payload?.provider_id;
    if (!providerId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check cache
    const cacheKey = `authz:user:${providerId}:${requestedAccountId || 'default'}`;
    const cached = await this.getCachedPrincipal(cacheKey);
    if (cached) {
      return cached;
    }

    // Lightweight query — skip eager relations
    const user = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.providerId', 'user.globalRoleId'])
      .where('user.provider_id = :providerId', { providerId })
      .andWhere('user.deleted_at IS NULL')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const globalRole = user.globalRoleId ? await this.roleRepository.findOne({ where: { id: user.globalRoleId } }) : null;
    const globalRoleCode = globalRole?.code || ROLE_CODES.EDITOR;

    if (globalRoleCode === ROLE_CODES.SUPER_ADMIN) {
      const ctx: PrincipalContext = {
        principalType: 'user',
        principalId: user.id,
        userId: user.id,
        sub: providerId,
        accountId: requestedAccountId,
        globalRole: globalRoleCode,
        effectiveRole: ROLE_CODES.SUPER_ADMIN,
        permissions: [...ALL_PERMISSION_KEYS],
        isSuperAdmin: true,
      };
      await this.cachePrincipal(cacheKey, ctx);
      return ctx;
    }

    // Lightweight query — skip eager relations (account, role) that cause cascade loads
    const memberships = await this.userAccountRepository
      .createQueryBuilder('ua')
      .select(['ua.userId', 'ua.accountId', 'ua.isMasterUser', 'ua.roleOverrideRoleId'])
      .where('ua.user_id = :userId', { userId: user.id })
      .getMany();
    const accountId = requestedAccountId || memberships[0]?.accountId;

    if (!accountId) {
      throw new ForbiddenException('User has no account membership');
    }

    const membership = memberships.find((item) => item.accountId === accountId);
    if (!membership) {
      throw new ForbiddenException('User does not belong to account');
    }

    let effectiveRoleCode = globalRoleCode;
    if (membership.roleOverrideRoleId) {
      const overrideRole = await this.roleRepository.findOne({ where: { id: membership.roleOverrideRoleId } });
      effectiveRoleCode = overrideRole?.code || effectiveRoleCode;
    }

    const ctx: PrincipalContext = {
      principalType: 'user',
      principalId: user.id,
      userId: user.id,
      sub: providerId,
      accountId,
      globalRole: globalRoleCode,
      effectiveRole: effectiveRoleCode,
      permissions: this.getPermissionsByRole(effectiveRoleCode),
      isSuperAdmin: false,
    };
    await this.cachePrincipal(cacheKey, ctx);
    return ctx;
  }

  async resolveApiKeyContext(rawApiKey: string): Promise<PrincipalContext> {
    const now = new Date();
    const keyHash = this.hashApiKey(rawApiKey);

    // Check cache first
    const cacheKey = `authz:apikey:${keyHash}`;
    const cached = await this.getCachedPrincipal(cacheKey);
    if (cached) {
      // Fire-and-forget lastUsedAt update
      if (cached.apiKeyId) {
        this.accountApiKeyRepository.update(cached.apiKeyId, { lastUsedAt: new Date() }).catch(() => null);
      }
      return cached;
    }

    const managedKey = await this.accountApiKeyRepository.findOne({
      where: [
        {
          keyHash,
          status: 'active',
          revokedAt: IsNull(),
          expiresAt: IsNull(),
        },
        {
          keyHash,
          status: 'active',
          revokedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      ],
    });

    if (managedKey) {
      this.accountApiKeyRepository.update(managedKey.id, { lastUsedAt: new Date() }).catch(() => null);

      const ctx: PrincipalContext = {
        principalType: 'api_key',
        principalId: managedKey.id,
        apiKeyId: managedKey.id,
        accountId: managedKey.accountId,
        effectiveRole: managedKey.role?.code || ROLE_CODES.ADMIN,
        permissions: this.getPermissionsByRole(managedKey.role?.code || ROLE_CODES.ADMIN),
        isSuperAdmin: false,
      };
      await this.cachePrincipal(cacheKey, ctx);
      return ctx;
    }

    const legacyKey = await this.accountConfigRepository.findOne({
      where: {
        name: In(['api_key', 'api_key_tracker']),
        value: rawApiKey,
      },
    });

    if (!legacyKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const legacyCtx: PrincipalContext = {
      principalType: 'api_key',
      principalId: legacyKey.accountId,
      apiKeyId: legacyKey.accountId,
      accountId: legacyKey.accountId,
      effectiveRole: ROLE_CODES.ADMIN,
      permissions: this.getPermissionsByRole(ROLE_CODES.ADMIN),
      isSuperAdmin: false,
    };
    await this.cachePrincipal(cacheKey, legacyCtx);
    return legacyCtx;
  }

  async validateApiKey(rawApiKey: string): Promise<PrincipalContext> {
    return this.resolveApiKeyContext(rawApiKey);
  }

  getPermissionsByRole(roleCode: string): string[] {
    if (roleCode === ROLE_CODES.SUPER_ADMIN) {
      return [...ALL_PERMISSION_KEYS];
    }
    return [...(ROLE_PERMISSIONS[roleCode] || [])];
  }

  hasPermissions(context: PrincipalContext, requiredPermissions: string[]): boolean {
    if (context.isSuperAdmin || context.effectiveRole === ROLE_CODES.SUPER_ADMIN) {
      return true;
    }

    return requiredPermissions.every((permission) => context.permissions.includes(permission));
  }

  async resolvePrincipalFromRequest(req: any): Promise<PrincipalContext | null> {
    const apiKey = this.getHeaderApiKey(req);
    if (apiKey) {
      return this.resolveApiKeyContext(apiKey);
    }

    const authHeader: string = req?.headers?.authorization || req?.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return null;
    }

    const payload = await this.verifyJwtToken(token);
    const accountId = this.getHeaderAccountId(req);
    return this.resolveUserContext(payload, accountId);
  }
}
