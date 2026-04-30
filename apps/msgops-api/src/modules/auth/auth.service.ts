import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { UserEntity } from '../../entities/users.entity';
import { UserRefreshTokenEntity } from '../../entities/user-refresh-token.entity';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { RedisService } from '../../providers/redis.provider';
import { AUTH_PROVIDER_TOKEN, AuthMeta, AuthTokens, IAuthProvider } from './providers/auth.provider.interface';
import { AuthLoginResponse, AuthRefreshResponse, AuthUserResponse } from './dto/auth-response.dto';

const PWD_RESET_TTL = 3600;
const PWD_RESET_RATE_LIMIT_WINDOW = 3600;
const PWD_RESET_RATE_LIMIT_MAX = 3;

@Injectable()
export class AuthService {
  private cachedTransporter: nodemailer.Transporter | null = null;
  private cachedTransporterFingerprint = '';

  constructor(
    @Inject(AUTH_PROVIDER_TOKEN) private readonly provider: IAuthProvider,
    @InjectRepository(UserEntity) private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserRefreshTokenEntity) private readonly refreshTokenRepository: Repository<UserRefreshTokenEntity>,
    @InjectRepository(SystemConfigEntity) private readonly systemConfigRepository: Repository<SystemConfigEntity>,
    private readonly redisService: RedisService,
  ) {}

  async login(email: string, password: string, meta: AuthMeta): Promise<AuthLoginResponse & { refreshToken: string }> {
    this.assertCredentialLogin();
    const tokens = await this.provider.login!(email, password, meta);
    const user = await this.loadUserByEmail(email);
    return {
      ...this.toResponse(tokens, user),
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string, meta: AuthMeta): Promise<AuthRefreshResponse & { refreshToken: string }> {
    this.assertCredentialLogin();
    const tokens = await this.provider.refresh!(refreshToken, meta);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    this.assertCredentialLogin();
    await this.provider.logout!(refreshToken);
  }

  async requestPasswordReset(userId: number): Promise<{ message: string }> {
    const frontendUrl = process.env.FRONTEND_URL;
    const fromEmail = process.env.TRANSACTIONAL_FROM_EMAIL;
    if (!frontendUrl || !fromEmail) {
      throw new InternalServerErrorException('Password reset email is not configured (FRONTEND_URL or TRANSACTIONAL_FROM_EMAIL missing)');
    }

    const recipient = await this.userRepository.findOneOrFail({ where: { id: userId } });
    const redis = this.redisService.getClient();

    const rateKey = `pwd_reset_rate:${userId}`;
    const attempts = await redis.incr(rateKey);
    if (attempts === 1) {
      await redis.expire(rateKey, PWD_RESET_RATE_LIMIT_WINDOW);
    }
    if (attempts > PWD_RESET_RATE_LIMIT_MAX) {
      throw new HttpException('Too many password reset requests for this user. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const token = uuidv4();
    await redis.set(`pwd_reset:${token}`, String(userId), 'EX', PWD_RESET_TTL);

    const smtpConfig = await this.systemConfigRepository.findOne({ where: { key: 'smtp_settings' } });
    if (!smtpConfig) {
      throw new ServiceUnavailableException('SMTP not configured');
    }

    const transporter = this.getTransporter(smtpConfig.value as { host: string; port: number; user: string; pass: string });
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: fromEmail,
      to: recipient.email,
      subject: 'Reset your password',
      html: `<p>Hi ${recipient.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    return { message: 'Password reset email sent' };
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<{ success: boolean }> {
    const redis = this.redisService.getClient();
    const userIdStr = await redis.get(`pwd_reset:${token}`);
    if (!userIdStr) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const userId = Number(userIdStr);
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
    await this.provider.updatePassword!(user.providerId, newPassword);
    await redis.del(`pwd_reset:${token}`);
    await this.refreshTokenRepository.delete({ userId });

    return { success: true };
  }

  private getTransporter(smtp: { host: string; port: number; user: string; pass: string }): nodemailer.Transporter {
    const fingerprint = `${smtp.host}:${smtp.port}:${smtp.user}`;
    if (this.cachedTransporter && this.cachedTransporterFingerprint === fingerprint) {
      return this.cachedTransporter;
    }
    this.cachedTransporter = nodemailer.createTransport({ host: smtp.host, port: smtp.port, auth: { user: smtp.user, pass: smtp.pass } } as any);
    this.cachedTransporterFingerprint = fingerprint;
    return this.cachedTransporter;
  }

  private assertCredentialLogin(): void {
    if (!this.provider.supportsCredentialLogin()) {
      throw new ForbiddenException('Credential login not supported by active auth provider');
    }
  }

  private async loadUserByEmail(email: string): Promise<UserEntity> {
    const user = await this.userRepository.createQueryBuilder('user').where('LOWER(user.email) = LOWER(:email)', { email }).andWhere('user.deleted_at IS NULL').getOne();
    if (!user) throw new UnauthorizedException('User not found after login');
    return user;
  }

  private toResponse(tokens: AuthTokens, user: UserEntity): AuthLoginResponse {
    const userResponse: AuthUserResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.profile || null,
      providerId: user.providerId,
    };
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: userResponse,
    };
  }
}
