import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { RedisModule } from '../../providers/redis.provider';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { EvolutionHubWebhookController } from './evolution-hub-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappChannelEntity]),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  controllers: [MetaWebhookController, EvolutionHubWebhookController],
  providers: [WhatsappWebhooksService],
  exports: [WhatsappWebhooksService],
})
export class WhatsappWebhooksModule {}
