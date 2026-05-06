import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';

import { AdminS3Controller } from './s3/admin-s3.controller';
import { AdminS3Service } from './s3/admin-s3.service';
import { AdminSendgridController } from './sendgrid/admin-sendgrid.controller';
import { AdminSendgridService } from './sendgrid/admin-sendgrid.service';
import { AdminFcmController } from './fcm/admin-fcm.controller';
import { AdminFcmService } from './fcm/admin-fcm.service';
import { AdminEmailableController } from './emailable/admin-emailable.controller';
import { AdminEmailableService } from './emailable/admin-emailable.service';

// SystemConfigCacheProvider is supplied by the global SystemConfigCacheModule
// registered at app boot — no need to re-import here.
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity])],
  controllers: [AdminS3Controller, AdminSendgridController, AdminFcmController, AdminEmailableController],
  providers: [AdminS3Service, AdminSendgridService, AdminFcmService, AdminEmailableService],
  exports: [AdminS3Service, AdminSendgridService, AdminFcmService, AdminEmailableService],
})
export class AdminIntegrationsModule {}
