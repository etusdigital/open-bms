import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { WhatsappChannelsService } from './whatsapp-channels.service';
import { WhatsappChannelsController } from './whatsapp-channels.controller';
import { WhatsappModeResolverModule } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.module';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappChannelEntity]), WhatsappModeResolverModule],
  controllers: [WhatsappChannelsController],
  providers: [WhatsappChannelsService],
  exports: [WhatsappChannelsService],
})
export class WhatsappChannelsModule {}
