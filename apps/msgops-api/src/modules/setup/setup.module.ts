import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { UserEntity } from '../../entities/users.entity';
import { RoleEntity } from '../../entities/role.entity';
import { AccountEntity } from '../../entities/account.entity';
import { PoolEntity } from '../../entities/pool.entity';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminIntegrationsModule } from '../admin-integrations/admin-integrations.module';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { EnterpriseImportModule } from '../enterprise-import/enterprise-import.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfigEntity, UserEntity, RoleEntity, AccountEntity, PoolEntity, UserAccountEntity]),
    AuthModule,
    AdminIntegrationsModule,
    // EnterpriseImportModule does not import SetupModule back — no cycle, so
    // a direct import keeps DI deterministic.
    EnterpriseImportModule,
    TelemetryModule,
  ],
  providers: [SetupService, ClickhouseProvider],
  controllers: [SetupController],
})
export class SetupModule {}
