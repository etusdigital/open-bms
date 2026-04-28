import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { PoolEntity } from '../../entities/pool.entity';
import { PoolsService } from './pools.service';
import { PoolsController } from './pools.controller';
import { RedisModule } from '../../providers/redis.provider';
import { SendgridHandler } from './../../handlers/email/sendgrid/sendgrid.handler';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([AccountConfigEntity, PoolEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  controllers: [PoolsController],
  providers: [AccountConfigsProvider, PoolsService, SendgridHandler],
  exports: [PoolsService],
})
export class PoolsModule {}
