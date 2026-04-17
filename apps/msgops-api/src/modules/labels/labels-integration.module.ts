import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsModule } from './labels.module';
import { LabelsEntity } from '../../entities/labels.entity';
import { LabelsContentsEntity } from '../../entities/labels-contents.entity';

@Module({
  imports: [LabelsModule, TypeOrmModule.forFeature([LabelsEntity, LabelsContentsEntity])],
  exports: [LabelsModule, TypeOrmModule],
})
export class LabelsIntegrationModule {}
