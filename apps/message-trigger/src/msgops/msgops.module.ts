import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from './entities/message.entity';
import { RedisModule } from '../providers/redis/redis.module';
import { ContactEntity } from './entities/contact.entity';
import { ContactCustomFieldEntity } from './entities/contact-custom-field.entity';
import { LeadsEntity } from './entities/leads.entity';
import { ClickhouseProvider } from '../providers/clickhouse.provider';

@Module({
  imports: [ConfigModule.forRoot(), RedisModule, TypeOrmModule.forFeature([MessageEntity, ContactEntity, ContactCustomFieldEntity, LeadsEntity])],
  exports: [MsgopsService],
  providers: [MsgopsService, ClickhouseProvider],
})
export class MsgopsModule {}
