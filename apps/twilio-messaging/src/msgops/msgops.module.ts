import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortLinkEntity } from './entities/short-link.entity';
import { RedisModule } from '../providers/redis/redis.module';

@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forFeature([ShortLinkEntity]), RedisModule],
  exports: [MsgopsService],
  providers: [MsgopsService],
})
export class MsgopsModule {}
