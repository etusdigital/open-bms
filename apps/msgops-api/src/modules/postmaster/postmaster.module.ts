import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PostmasterController } from './postmaster.controller';
import { PostmasterService } from './postmaster.service';
import { PostmasterEntity } from 'src/entities/postmaster.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../providers/redis.provider';
import { PoolEntity } from 'src/entities/pool.entity';
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([PostmasterEntity, PoolEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  providers: [PostmasterService],
  controllers: [PostmasterController],
  exports: [PostmasterService],
})
export class PostmasterModule {}
