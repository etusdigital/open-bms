import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { AccountUsageEntity } from './entities/account-usage.entity';
import { EmailValidateEntity } from './entities/email-validate.entity';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forFeature([AccountEntity, AccountConfigEntity, AccountApiKeyEntity, AccountUsageEntity, EmailValidateEntity])],
  exports: [MsgopsService],
  providers: [MsgopsService],
})
export class MsgopsModule {}
