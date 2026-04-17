import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GoogleCloudStorageProvider } from '../../providers/google-cloud-storage.provider';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';

@Module({
  imports: [HttpModule],
  providers: [GoogleCloudStorageProvider, BucketsService],
  controllers: [BucketsController],
})
export class BucketsModule {}
