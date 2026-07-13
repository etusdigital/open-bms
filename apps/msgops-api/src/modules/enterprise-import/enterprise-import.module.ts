import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module';
import { EnterpriseImportJobEntity } from '../../entities/enterprise-import-job.entity';
import { EnterpriseIdMappingEntity } from '../../entities/enterprise-id-mapping.entity';
import { AccountEntity } from '../../entities/account.entity';
import { ContactEntity } from '../../entities/contact.entity';
import { EmailReconcileSessionEntity } from '../../entities/email-reconcile-session.entity';
import { EmailReconcileItemEntity } from '../../entities/email-reconcile-item.entity';
import { QUEUE_ENTERPRISE_IMPORT } from '../../providers/queue/queue.constants';
import { EnterpriseImportController } from './enterprise-import.controller';
import { EnterpriseImportService } from './enterprise-import.service';
import { EmailReconcileService } from './email-reconcile.service';
import { EmailReconcileSessionService } from './email-reconcile-session.service';
import { EnterpriseImportEnabledGuard } from './enterprise-import.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_ENTERPRISE_IMPORT }),
    TypeOrmModule.forFeature([EnterpriseImportJobEntity, EnterpriseIdMappingEntity, AccountEntity, ContactEntity, EmailReconcileSessionEntity, EmailReconcileItemEntity]),
    AccountsModule,
  ],
  controllers: [EnterpriseImportController],
  providers: [EnterpriseImportService, EmailReconcileService, EmailReconcileSessionService, EnterpriseImportEnabledGuard],
  exports: [EnterpriseImportService],
})
export class EnterpriseImportModule {}
