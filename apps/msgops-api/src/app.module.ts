import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JoiPipeModule } from 'nestjs-joi';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './auth/auth.module';
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
import { AccountsModule } from './modules/accounts/accounts.module';
import { TagsModule } from './modules/tags/tags.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { UsersModule } from './modules/users/users.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { VerifyModule } from './modules/verify/verify.module';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { WarmupsModule } from './modules/warmups/warmups.module';
import { PostmasterModule } from './modules/postmaster/postmaster.module';
import { CustomEventModule } from './modules/custom-events/custom-events.module';
import { BatchModule } from './modules/batch/batch.module';
import { CampaignsRulesModule } from './modules/campaigns-rules/campaigns-rules.module';
import { LabelsModule } from './modules/labels/labels.module';
import { IpReputationModule } from './modules/ip-reputation/ip-reputation.module';
import { AuthzModule } from './modules/authz/authz.module';
import { SetupModule } from './modules/setup/setup.module';

@Module({
  imports: [
    JoiPipeModule,
    TypeOrmModule.forRoot(dataSourceOptions),
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
    TagsModule,
    CustomEventModule,
    CustomFieldsModule,
    UsersModule,
    StatisticsModule,
    WarmupsModule,
    PostmasterModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
      },
    }),
    VerifyModule,
    BatchModule,
    CampaignsRulesModule,
    LabelsModule,
    IpReputationModule,
    SetupModule,
  ],
  providers: [AuditSubscriber],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
