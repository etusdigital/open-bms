import { BadRequestException, Injectable } from '@nestjs/common';
import { EventTracker, SubscriptionMessage } from '../app.interfaces';

@Injectable()
export class FormatterUtils {
  parseBatch(subscriptionMessage: SubscriptionMessage): EventTracker {
    const {
      message: { data },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      const eventTracker: EventTracker = JSON.parse(buff);

      return eventTracker;
    } catch (_error) {
      throw new BadRequestException(
        `Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `,
      );
    }
  }
}
