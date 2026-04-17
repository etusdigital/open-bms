import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthzModule } from '../modules/authz/authz.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AuthzModule],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
