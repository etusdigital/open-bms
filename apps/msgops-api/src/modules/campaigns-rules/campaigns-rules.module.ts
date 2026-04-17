import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsRulesController } from './campaigns-rules.controller';
import { CampaignsRulesService } from './campaigns-rules.service';
import { CampaignsConfigsEntity } from '../../entities/campaigns-configs.entity';
import { CampaignsRulesEntity } from '../../entities/campaigns-rules.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignsRulesEntity, CampaignsConfigsEntity])],
  controllers: [CampaignsRulesController],
  exports: [CampaignsRulesService],
  providers: [CampaignsRulesService],
})
export class CampaignsRulesModule {}
