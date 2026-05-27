import { Global, Module } from '@nestjs/common';
import { EventPublisherService } from './event-publisher.service';

@Global()
@Module({
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class MessagingModule {}
