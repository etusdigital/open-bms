import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MsgopsModule } from './msgops/msgops.module';
import { EMAIL_VALIDATION_PROVIDER_TOKEN } from './providers/email-validation.provider.interface';
import { NoopProvider } from './providers/noop.provider';
import { typeOrmConfig } from './ormconfig';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), RedisModule, MsgopsModule],
  controllers: [AppController],
  providers: [
    AppService,
    NoopProvider,
    {
      provide: EMAIL_VALIDATION_PROVIDER_TOKEN,
      useClass: NoopProvider,
    },
  ],
})
export class AppModule {}
