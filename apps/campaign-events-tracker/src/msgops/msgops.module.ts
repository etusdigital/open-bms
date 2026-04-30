import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { ContactEntity } from './entities/contact.entity';
import { RedisModule } from '../providers/redis/redis.module';
import { QueueModule } from '../providers/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([CampaignEntity, CampaignContactEntity, ContactEntity]),
    RedisModule,
    QueueModule,
  ],
  exports: [MsgopsService],
  providers: [MsgopsService],
})
export class MsgopsModule {}
