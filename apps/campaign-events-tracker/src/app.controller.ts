import { Body, Controller, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
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
  addEventTracker(
    @Headers('x-internal-token') token: string,
    @Body() data: EventTracker | SubscriptionMessage,
    @Query() { debug }: { debug: string },
  ) {
    if (token !== process.env.INTERNAL_AUTH_TOKEN) {
      throw new UnauthorizedException();
    }
    const eventTracker =
      'subscription' in (data as EventTracker)
        ? this.formatterUtils.parseBatch(data as SubscriptionMessage)
        : (data as EventTracker);

    return this.appService.addEventTracker(eventTracker, debug);
  }
}
