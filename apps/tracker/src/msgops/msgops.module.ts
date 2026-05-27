import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { ContactEntity } from './entities/contact.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { RedisModule } from '../providers/redis/redis.module';
import { ShortLinkEntity } from './entities/short-link.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { FormatterUtils } from 'src/utils/formatter.utils';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([AccountEntity, AccountConfigEntity, AccountApiKeyEntity, ContactEntity, ContactTagEntity, ShortLinkEntity]),
    RedisModule,
  ],
  exports: [MsgopsService],
  providers: [MsgopsService, FormatterUtils],
})
export class MsgopsModule {}
