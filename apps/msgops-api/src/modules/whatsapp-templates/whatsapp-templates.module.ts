import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { WhatsappTemplateSyncService } from './whatsapp-template-sync.service';
import { WhatsappModeResolverModule } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.module';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappChannelEntity, AccountConfigEntity]), WhatsappModeResolverModule],
  providers: [WhatsappTemplateSyncService],
  exports: [WhatsappTemplateSyncService],
})
export class WhatsappTemplatesModule {}
