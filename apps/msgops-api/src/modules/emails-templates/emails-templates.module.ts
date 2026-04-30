import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { EmailsTemplatesEntity } from '../../entities/emails-templates.entity';
import { EmailsTemplatesService } from './emails-templates.service';
import { EmailsTemplatesController } from './emails-templates.controller';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([EmailsTemplatesEntity])],
  controllers: [EmailsTemplatesController],
  providers: [EmailsTemplatesService, S3StorageProvider],
})
export class EmailsTemplatesModule {}
