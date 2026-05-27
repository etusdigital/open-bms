import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { LabelsEntity } from '../../entities/labels.entity';
import { LabelsContentsEntity } from '../../entities/labels-contents.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LabelsEntity, LabelsContentsEntity])],
  controllers: [LabelsController],
  exports: [LabelsService],
  providers: [LabelsService],
})
export class LabelsModule {}
