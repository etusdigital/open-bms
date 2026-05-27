import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrackerService } from './tracker.service';

@Module({
  imports: [ConfigModule.forRoot()],
  exports: [TrackerService],
  providers: [TrackerService],
})
export class TrackerModule {}
