import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { DbProvider } from '../providers/db.provider';
import { FormatterUtils } from '../utils/formatter.utils';
import { CacheService } from './cache.service';
import { RedisModule } from '../providers/redis/redis.module';

@Module({
  imports: [ConfigModule.forRoot(), DbProvider, RedisModule],
  exports: [MsgopsService],
  providers: [MsgopsService, FormatterUtils, CacheService],
})
export class MsgopsModule {}
