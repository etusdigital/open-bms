import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './providers/redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MsgopsModule } from './msgops/msgops.module';
import { EMAIL_VALIDATION_PROVIDER_TOKEN, IEmailValidationProvider } from './providers/email-validation.provider.interface';
import { EmailableProvider } from './providers/emailable.provider';
import { NoopProvider } from './providers/noop.provider';
import { typeOrmConfig } from './ormconfig';

const providerChoice = (process.env.EMAIL_VALIDATION_PROVIDER || 'noop').trim().toLowerCase();

if (providerChoice !== 'emailable' && providerChoice !== 'noop') {
  throw new Error(`Invalid EMAIL_VALIDATION_PROVIDER: ${providerChoice}. Expected "emailable" or "noop".`);
}

if (providerChoice === 'emailable') {
  const missing: string[] = [];
  if (!process.env.EMAILABLE_API_KEY) missing.push('EMAILABLE_API_KEY');
  if (!process.env.EMAILABLE_URL) missing.push('EMAILABLE_URL');
  if (missing.length) {
    throw new Error(`EMAIL_VALIDATION_PROVIDER=emailable requires: ${missing.join(', ')}. Set them or switch to EMAIL_VALIDATION_PROVIDER=noop.`);
  }
}

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(typeOrmConfig), RedisModule, MsgopsModule],
  controllers: [AppController],
  providers: [
    AppService,
    EmailableProvider,
    NoopProvider,
    {
      provide: EMAIL_VALIDATION_PROVIDER_TOKEN,
      useFactory: (emailable: EmailableProvider, noop: NoopProvider): IEmailValidationProvider => (providerChoice === 'emailable' ? emailable : noop),
      inject: [EmailableProvider, NoopProvider],
    },
  ],
})
export class AppModule {}
