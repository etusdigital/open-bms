import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { RedisModule } from '../providers/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([AccountEntity, AccountConfigEntity, AccountApiKeyEntity, CustomFieldsEntity]),
    RedisModule,
  ],
  exports: [MsgopsService],
  providers: [MsgopsService],
})
export class MsgopsModule {}
