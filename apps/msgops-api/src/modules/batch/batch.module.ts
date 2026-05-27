import { Module } from '@nestjs/common';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { MessagesModule } from '../messages/messages.module';
import { CampaignModule } from '../campaigns/campaigns.module';
import { CampaignEntity } from 'src/entities/campaign.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from 'src/entities/message.entity';

@Module({
  imports: [CampaignModule, MessagesModule, TypeOrmModule.forFeature([CampaignEntity, MessageEntity])],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
