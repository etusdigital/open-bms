import { BadRequestException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { UserEntity } from '../../../entities/users.entity';
import { UserCredentialsEntity } from '../../../entities/user-credentials.entity';
import { UserRefreshTokenEntity } from '../../../entities/user-refresh-token.entity';
import { AuthzService } from '../../authz/authz.service';
import { AuthMeta, AuthTokens, CreateAuthUserInput, IAuthProvider, NormalizedJwtPayload, UpdateAuthUserInput } from './auth.provider.interface';

const BCRYPT_ROUNDS = 12;
const JWT_ISSUER = 'bms-msgops-api';
const PROVIDER_PREFIX = 'local|';

@Injectable()
export class LocalAuthProvider implements IAuthProvider {
  private readonly logger = new Logger(LocalAuthProvider.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserCredentialsEntity)
    private readonly credentialsRepository: Repository<UserCredentialsEntity>,
    @InjectRepository(UserRefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<UserRefreshTokenEntity>,
    @Inject(forwardRef(() => AuthzService))
    private readonly authzService: AuthzService,
  ) {}

  supportsCredentialLogin(): boolean {
    return true;
  }

  async createUser(_input: CreateAuthUserInput): Promise<{ providerId: string }> {
    // Local provider only mints a providerId. The UserEntity insert is owned by
    // UsersService.create (which needs globalRoleId, accounts, etc.), which must
    // then call `updatePassword(providerId, password)` to persist credentials.
    // Callers that skip the follow-up produce a user that cannot log in.
    return { providerId: `${PROVIDER_PREFIX}${uuidv4()}` };
  }

  async updateUser(providerId: string, patch: UpdateAuthUserInput): Promise<void> {
    const data: Partial<UserEntity> = {};
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.picture !== undefined) data.profile = patch.picture;
    if (Object.keys(data).length === 0) return;

    await this.userRepository.createQueryBuilder().update(UserEntity).set(data).where('provider_id = :providerId', { providerId }).andWhere('deleted_at IS NULL').execute();
  }

  async updatePassword(providerId: string, newPassword: string, em?: EntityManager): Promise<void> {
    if (!providerId.startsWith(PROVIDER_PREFIX)) {
      throw new BadRequestException('LocalAuthProvider cannot update non-local provider user');
    }
    // When called from inside a transaction, the just-saved user row is only visible
    // through the transaction's EntityManager. Fall back to the injected pool repos
    // when no EM is provided.
    const userRepo = em ? em.getRepository(UserEntity) : this.userRepository;
    const credentialsRepo = em ? em.getRepository(UserCredentialsEntity) : this.credentialsRepository;
    const user = await userRepo.findOne({ where: { providerId } });
    if (!user) throw new NotFoundException('User not found');
    await this.upsertCredentials(user.id, newPassword, credentialsRepo);
    await this.authzService.invalidateUserCache(providerId);
  }

  async deleteUser(providerId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { providerId } });
    if (!user) return;
    await this.userRepository.softDelete(user.id);
    await this.authzService.invalidateUserCache(providerId);
  }

  async verifyToken(accessToken: string): Promise<NormalizedJwtPayload> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET not configured');
    }
    try {
      const payload = jwt.verify(accessToken, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      }) as NormalizedJwtPayload;
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async login(email: string, password: string, meta?: AuthMeta): Promise<AuthTokens> {
    const user = await this.userRepository.createQueryBuilder('user').where('LOWER(user.email) = LOWER(:email)', { email }).andWhere('user.deleted_at IS NULL').getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const credentials = await this.credentialsRepository.findOne({ where: { userId: user.id } });
    if (!credentials) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, credentials.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user, meta);
  }

  async refresh(refreshToken: string, meta?: AuthMeta): Promise<AuthTokens> {
    const tokenHash = this.sha256(refreshToken);
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(UserRefreshTokenEntity)
      .set({ revokedAt: () => 'NOW()' })
      .where('token_hash = :tokenHash', { tokenHash })
      .andWhere('revoked_at IS NULL')
      .andWhere('expires_at > NOW()')
      .returning(['userId'])
      .execute();

    const affected = (result.raw as any[]) || [];
    if (affected.length === 0) {
      // Only a previously revoked row is reuse. Expired-but-never-revoked rows are normal
      // expiry and must not trigger the security alarm.
      const existed = await this.refreshTokenRepository.findOne({ where: { tokenHash } });
      if (existed && existed.revokedAt) {
        this.logger.warn({
          event: 'refresh_token_reuse_detected',
          tokenHash,
          userAgent: meta?.userAgent,
          ip: meta?.ip,
          timestamp: new Date().toISOString(),
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = affected[0].user_id ?? affected[0].userId;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens(user, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.sha256(refreshToken);
    const existing = await this.refreshTokenRepository.findOne({ where: { tokenHash } });

    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(UserRefreshTokenEntity)
      .set({ revokedAt: () => 'NOW()' })
      .where('token_hash = :tokenHash', { tokenHash })
      .andWhere('revoked_at IS NULL')
      .execute();

    if (existing) {
      const user = await this.userRepository.findOne({ where: { id: existing.userId } });
      if (user?.providerId) {
        await this.authzService.invalidateUserCache(user.providerId);
      }
    }
  }

  private async upsertCredentials(userId: number, password: string, repo: Repository<UserCredentialsEntity> = this.credentialsRepository): Promise<void> {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await repo.findOne({ where: { userId } });
    if (existing) {
      await repo.update({ userId }, { passwordHash: hash });
    } else {
      await repo.save(repo.create({ userId, passwordHash: hash }));
    }
  }

  private async issueTokens(user: UserEntity, meta?: AuthMeta): Promise<AuthTokens> {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('JWT_SECRET not configured');

    const expiresIn = parseInt(process.env.JWT_ACCESS_TTL || '3600', 10);
    const refreshTtl = parseInt(process.env.JWT_REFRESH_TTL || '2592000', 10);

    const accessToken = jwt.sign(
      {
        sub: user.providerId,
        email: user.email,
        name: user.name,
        picture: user.profile || undefined,
        email_verified: true,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn,
        issuer: JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      },
    );

    const refreshToken = uuidv4();
    const tokenHash = this.sha256(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        ip: meta?.ip ?? null,
      }),
    );

    return { accessToken, refreshToken, expiresIn };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
