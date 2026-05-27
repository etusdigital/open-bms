import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';

import { AdminS3Controller } from './s3/admin-s3.controller';
import { AdminS3Service } from './s3/admin-s3.service';
import { AdminSendgridController } from './sendgrid/admin-sendgrid.controller';
import { AdminSendgridService } from './sendgrid/admin-sendgrid.service';
import { AdminFcmController } from './fcm/admin-fcm.controller';
import { AdminFcmService } from './fcm/admin-fcm.service';
import { AdminMailerSendController } from './mailersend/admin-mailersend.controller';
import { AdminMailerSendService } from './mailersend/admin-mailersend.service';
import { AdminResendController } from './resend/admin-resend.controller';
import { AdminResendService } from './resend/admin-resend.service';
import { AdminSesController } from './amazon-ses/admin-ses.controller';
import { AdminSesService } from './amazon-ses/admin-ses.service';
import { AdminMandrillController } from './mandrill/admin-mandrill.controller';
import { AdminMandrillService } from './mandrill/admin-mandrill.service';

// SystemConfigCacheProvider is supplied by the global SystemConfigCacheModule
// registered at app boot — no need to re-import here.
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity])],
  controllers: [AdminS3Controller, AdminSendgridController, AdminFcmController, AdminMailerSendController, AdminResendController, AdminSesController, AdminMandrillController],
  providers: [AdminS3Service, AdminSendgridService, AdminFcmService, AdminMailerSendService, AdminResendService, AdminSesService, AdminMandrillService],
  exports: [AdminS3Service, AdminSendgridService, AdminFcmService, AdminMailerSendService, AdminResendService, AdminSesService, AdminMandrillService],
})
export class AdminIntegrationsModule {}
