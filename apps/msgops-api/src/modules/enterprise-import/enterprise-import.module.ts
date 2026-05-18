import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module';
import { EnterpriseImportJobEntity } from '../../entities/enterprise-import-job.entity';
import { EnterpriseIdMappingEntity } from '../../entities/enterprise-id-mapping.entity';
import { AccountEntity } from '../../entities/account.entity';
import { QUEUE_ENTERPRISE_IMPORT } from '../../providers/queue/queue.constants';
import { EnterpriseImportController } from './enterprise-import.controller';
import { EnterpriseImportService } from './enterprise-import.service';
import { EnterpriseImportEnabledGuard } from './enterprise-import.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_ENTERPRISE_IMPORT }),
    TypeOrmModule.forFeature([EnterpriseImportJobEntity, EnterpriseIdMappingEntity, AccountEntity]),
    AccountsModule,
  ],
  controllers: [EnterpriseImportController],
  providers: [EnterpriseImportService, EnterpriseImportEnabledGuard],
  exports: [EnterpriseImportService],
})
export class EnterpriseImportModule {}
