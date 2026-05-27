import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { WhatsappModeResolverModule } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.module';

@Module({
  imports: [WhatsappModeResolverModule],
  controllers: [FeatureFlagsController],
})
export class FeatureFlagsModule {}
