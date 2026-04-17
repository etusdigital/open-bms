import { Body, Controller, Post, Query } from '@nestjs/common';
import { EventTracker, SubscriptionMessage } from './app.interfaces';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly formatterUtils: FormatterUtils,
  ) {}

  @Post()
  addEventTracker(@Body() data: EventTracker | SubscriptionMessage, @Query() { debug }: { debug: string }) {
    const eventTracker =
      'subscription' in (data as EventTracker)
        ? this.formatterUtils.parseBatch(data as SubscriptionMessage)
        : (data as EventTracker);

    return this.appService.addEventTracker(eventTracker, debug);
  }
}
