import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../entities/users.entity';
import { UserCredentialsEntity } from '../../entities/user-credentials.entity';
import { UserRefreshTokenEntity } from '../../entities/user-refresh-token.entity';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { AuthzModule } from '../authz/authz.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_PROVIDER_TOKEN, IAuthProvider } from './providers/auth.provider.interface';
import { Auth0AuthProvider } from './providers/auth0-auth.provider';
import { LocalAuthProvider } from './providers/local-auth.provider';

const authProviderChoice = (process.env.AUTH_PROVIDER || 'local').toLowerCase();

if (authProviderChoice !== 'local' && authProviderChoice !== 'auth0') {
  throw new Error(`Invalid AUTH_PROVIDER: ${authProviderChoice}. Expected "local" or "auth0".`);
}

const controllers = authProviderChoice === 'auth0' ? [] : [AuthController];

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserCredentialsEntity, UserRefreshTokenEntity, SystemConfigEntity]), forwardRef(() => AuthzModule)],
  controllers,
  providers: [
    LocalAuthProvider,
    Auth0AuthProvider,
    {
      provide: AUTH_PROVIDER_TOKEN,
      useFactory: (localProvider: LocalAuthProvider, auth0Provider: Auth0AuthProvider): IAuthProvider => {
        return authProviderChoice === 'auth0' ? auth0Provider : localProvider;
      },
      inject: [LocalAuthProvider, Auth0AuthProvider],
    },
    AuthService,
  ],
  exports: [AUTH_PROVIDER_TOKEN, AuthService],
})
export class AuthModule {}
