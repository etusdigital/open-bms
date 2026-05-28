import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JoiPipeModule } from 'nestjs-joi';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { BucketsModule } from './modules/buckets/buckets.module';
import { TestsModule } from './modules/tests/tests.module';
import { ServicesModule } from './modules/services/services.module';
import { CampaignModule } from './modules/campaigns/campaigns.module';
import { EmailsTemplatesModule } from './modules/emails-templates/emails-templates.module';
import { AuditsModule } from './modules/audits/audits.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { PoolsModule } from './modules/pools/pools.module';
import { SendersModule } from './modules/senders/senders.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TagsModule } from './modules/tags/tags.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { UsersModule } from './modules/users/users.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { PostmasterModule } from './modules/postmaster/postmaster.module';
import { BatchModule } from './modules/batch/batch.module';
import { LabelsModule } from './modules/labels/labels.module';
import { AuthzModule } from './modules/authz/authz.module';
import { SetupModule } from './modules/setup/setup.module';
import { AccountSettingsModule } from './modules/account-settings/account-settings.module';
import { AdminGeoIpModule } from './modules/admin-geoip/admin-geoip.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AdminIntegrationsModule } from './modules/admin-integrations/admin-integrations.module';
import { EnterpriseImportModule } from './modules/enterprise-import/enterprise-import.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { WhatsappModeResolverModule } from './modules/whatsapp-mode-resolver/whatsapp-mode-resolver.module';
import { WhatsappChannelsModule } from './modules/whatsapp-channels/whatsapp-channels.module';
import { WhatsappWebhooksModule } from './modules/whatsapp-webhooks/whatsapp-webhooks.module';
import { BmsLeadsModule } from './modules/bms-leads/bms-leads.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { MessagingModule } from './providers/messaging/messaging.module';
import { QueueModule } from './providers/queue/queue.module';
import { SystemConfigCacheModule } from './providers/system-config-cache.module';

@Module({
  imports: [
    JoiPipeModule,
    TypeOrmModule.forRoot(dataSourceOptions),
    MessagingModule,
    QueueModule,
    SystemConfigCacheModule,
    AuthzModule,
    AuthModule,
    CampaignModule,
    TestsModule,
    BucketsModule,
    AutomationsModule,
    MessagesModule,
    ServicesModule,
    EmailsTemplatesModule,
    AccountsModule,
    AuditsModule,
    ContactsModule,
    PoolsModule,
    SendersModule,
    TagsModule,
    CustomFieldsModule,
    UsersModule,
    StatisticsModule,
    PostmasterModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
      },
    }),
    BatchModule,
    LabelsModule,
    SetupModule,
    AccountSettingsModule,
    AdminGeoIpModule,
    AdminIntegrationsModule,
    ActivityModule,
    EnterpriseImportModule,
    WhatsappModeResolverModule,
    FeatureFlagsModule,
    WhatsappChannelsModule,
    WhatsappWebhooksModule,
    BmsLeadsModule,
    TelemetryModule,
  ],
  providers: [AuditSubscriber],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
