import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { EnterpriseClient } from './enterprise-client/enterprise.client';
import { IdMapperService } from './id-mapper.service';
import { SequenceAdvancerService } from './sequence-advancer.service';
import { EnterpriseImportProcessor } from './enterprise-import.processor';
import { TagsImporter } from './importers/tags.importer';
import { CustomFieldsImporter } from './importers/custom-fields.importer';
import { LabelsImporter } from './importers/labels.importer';
import { EmailTemplatesImporter } from './importers/email-templates.importer';
import { ContactsImporter } from './importers/contacts.importer';
import { CustomEventsImporter } from './importers/custom-events.importer';
import { AutomationsImporter } from './importers/automations.importer';
import { CampaignsImporter } from './importers/campaigns.importer';
import { MessagesImporter } from './importers/messages.importer';
import { StatisticsImporter } from './importers/statistics.importer';
import { ImportPipeline } from './pipeline';
import { HealthController } from './health.controller';

// F6: entities listadas EXPLICITAMENTE (classes), não via glob de filesystem.
// O glob antigo (`__dirname/./entities/*.ts`) era resolvido
// em runtime e quebrava no container (apontava p/ .ts inexistentes no dist).
// Classes importadas são resolvidas em build (webpack bundle), sem fs runtime.
import { EnterpriseImportJobEntity } from './entities/enterprise-import-job.entity';
import { EnterpriseIdMappingEntity } from './entities/enterprise-id-mapping.entity';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { ContactEntity } from './entities/contact.entity';
import { TagEntity } from './entities/tag.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { LabelsEntity } from './entities/labels.entity';
import { EmailsTemplatesEntity } from './entities/emails-templates.entity';
import { CustomEventEntity } from './entities/custom-event.entity';
import { AutomationEntity } from './entities/automation.entity';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignMessageEntity } from './entities/campaign-message.entity';
import { MessageEntity } from './entities/message.entity';
import { UserEntity } from './entities/users.entity';
import { UserAccountEntity } from './entities/users-account.entity';
import { EventStatisticsEntity } from './entities/event-statistics.entity';
import { SystemConfigEntity } from './entities/system-config.entity';

const ENTITIES = [
  EnterpriseImportJobEntity,
  EnterpriseIdMappingEntity,
  AccountEntity,
  AccountConfigEntity,
  ContactEntity,
  TagEntity,
  CustomFieldsEntity,
  LabelsEntity,
  EmailsTemplatesEntity,
  CustomEventEntity,
  AutomationEntity,
  CampaignEntity,
  CampaignMessageEntity,
  MessageEntity,
  UserEntity,
  UserAccountEntity,
  EventStatisticsEntity,
  SystemConfigEntity,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.TYPEORM_HOST || 'localhost',
      port: parseInt(process.env.TYPEORM_PORT || '5432', 10),
      username: process.env.TYPEORM_USERNAME,
      password: process.env.TYPEORM_PASSWORD,
      database: process.env.TYPEORM_DATABASE,
      synchronize: false,
      logging: process.env.TYPEORM_LOGGING === 'true',
      entities: ENTITIES,
      ssl: process.env.TYPEORM_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature([EnterpriseImportJobEntity, EnterpriseIdMappingEntity]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({ name: 'enterprise-import' }),
  ],
  controllers: [HealthController],
  providers: [
    EnterpriseClient,
    IdMapperService,
    SequenceAdvancerService,
    EnterpriseImportProcessor,
    TagsImporter,
    CustomFieldsImporter,
    LabelsImporter,
    EmailTemplatesImporter,
    ContactsImporter,
    CustomEventsImporter,
    AutomationsImporter,
    CampaignsImporter,
    MessagesImporter,
    StatisticsImporter,
    ImportPipeline,
  ],
})
export class AppModule {}
