import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagsController } from './tags.controller';
import { TagEntity } from '../../entities/tag.entity';
import { ContactTagEntity } from '../../entities/contact-tag.entity';
import { TagsService } from './tags.service';
import { UtilsModule } from '../../utils/utils.module';
import { GoogleTasksProvider } from '../../providers/google-tasks.provider';
import { AutomationsModule } from '../automations/automations.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CampaignModule } from '../campaigns/campaigns.module';
import { SegmentQueryBuilderProvider } from './builder/query-builder.provider';

@Module({
  imports: [AccountsModule, AutomationsModule, CampaignModule, TypeOrmModule.forFeature([TagEntity, ContactTagEntity]), UtilsModule, HttpModule],
  controllers: [TagsController],
  providers: [GoogleTasksProvider, TagsService, SegmentQueryBuilderProvider],
  exports: [TagsService],
})
export class TagsModule {}
