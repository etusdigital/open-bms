import { Global, Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_ENTERPRISE_IMPORT, SCHEDULER_QUEUE_NAMES } from './queue.constants';
import { SchedulerService } from './scheduler.service';
import { BmsUsageProcessor, CampaignTestabProcessor, CampaignTriggerProcessor, SegmentProcessor, WhatsappMessageProcessor } from './scheduler.processor';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    ...SCHEDULER_QUEUE_NAMES.map((name) => BullModule.registerQueue({ name })),
    BullModule.registerQueue({ name: QUEUE_ENTERPRISE_IMPORT }),
  ],
  providers: [SchedulerService, CampaignTriggerProcessor, CampaignTestabProcessor, SegmentProcessor, BmsUsageProcessor, WhatsappMessageProcessor],
  exports: [SchedulerService, BullModule],
})
export class QueueModule implements OnModuleInit {
  onModuleInit(): void {
    // Without CRON_SECRET, the scheduler processors would fire HTTP loopbacks
    // that PrincipalContextGuard silently rejects with 401, dropping every
    // scheduled job. Fail loud at boot instead of corrupting state at runtime.
    if (!process.env.CRON_SECRET) {
      throw new Error('CRON_SECRET environment variable is required for the BullMQ scheduler self-callback (PrincipalContextGuard rejects requests without X-Cron-Secret)');
    }
  }
}
