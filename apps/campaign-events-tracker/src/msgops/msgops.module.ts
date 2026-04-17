import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { ContactEntity } from './entities/contact.entity';
import { RedisModule } from '../providers/redis/redis.module';
import { GoogleTasksProvider } from '../providers/google-tasks.provider';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([CampaignEntity, CampaignContactEntity, ContactEntity]),
    RedisModule,
  ],
  exports: [MsgopsService],
  providers: [MsgopsService, GoogleTasksProvider],
})
export class MsgopsModule {}
