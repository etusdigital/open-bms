import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';

@Module({
  imports: [HttpModule],
  providers: [S3StorageProvider, BucketsService],
  controllers: [BucketsController],
})
export class BucketsModule {}
