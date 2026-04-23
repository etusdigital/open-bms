import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/users.entity';
import { AUTH_PROVIDER_TOKEN, AuthMeta, AuthTokens, IAuthProvider } from './providers/auth.provider.interface';
import { AuthLoginResponse, AuthRefreshResponse, AuthUserResponse } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER_TOKEN) private readonly provider: IAuthProvider,
    @InjectRepository(UserEntity) private readonly userRepository: Repository<UserEntity>,
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
