import { Module } from '@nestjs/common';
import { WhatsappModeResolverService } from './whatsapp-mode-resolver.service';

@Module({
  providers: [WhatsappModeResolverService],
  exports: [WhatsappModeResolverService],
})
export class WhatsappModeResolverModule {}
