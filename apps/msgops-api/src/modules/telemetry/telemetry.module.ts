import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { RoleEntity } from '../../entities/role.entity';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity, RoleEntity])],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
