import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestsModule } from './../tests/tests.module';
import { AuditController } from './audits.controller';
import { AuditEntity } from '../../entities/audit.entity';
import { UserEntity } from '../../entities/users.entity';
import { AuditService } from './audits.service';

@Module({
  imports: [HttpModule, TestsModule, TypeOrmModule.forFeature([AuditEntity, UserEntity])],
  providers: [AuditService],
  controllers: [AuditController],
})
export class AuditsModule {}
