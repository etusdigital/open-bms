import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomEventController } from './custom-events.controller';
import { CustomEventService } from './custom-events.service';
import { CustomEventEntity } from 'src/entities/custom-event.entity';
import { AccountsModule } from '../accounts/accounts.module';
import { EventsLogEntity } from 'src/entities/events-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomEventEntity, EventsLogEntity]), AccountsModule],
  controllers: [CustomEventController],
  providers: [CustomEventService],
  exports: [CustomEventService],
})
export class CustomEventModule {}
