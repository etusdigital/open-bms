import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { MessageEntity } from '../../entities/message.entity';
import { ContactEntity } from '../../entities/contact.entity';
import { WhatsappMessageSendEntity } from '../../entities/whatsapp-message-send.entity';
import { WhatsappInboundMessageEntity } from '../../entities/whatsapp-inbound-message.entity';
import { RedisModule } from '../../providers/redis.provider';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';
import { WhatsappSendPersisterService } from './whatsapp-send-persister.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { EvolutionHubWebhookController } from './evolution-hub-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappChannelEntity, MessageEntity, ContactEntity, WhatsappMessageSendEntity, WhatsappInboundMessageEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  controllers: [MetaWebhookController, EvolutionHubWebhookController],
  providers: [WhatsappWebhooksService, WhatsappSendPersisterService],
  exports: [WhatsappWebhooksService],
})
export class WhatsappWebhooksModule {}
