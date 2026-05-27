import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SubscriptionMessage } from '../interfaces';

@Injectable()
export class FormatterUtils {
  private readonly logger = new Logger(FormatterUtils.name);

  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  parseBatch(subscriptionMessage: SubscriptionMessage) {
    const {
      message: { data, messageId },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      const campaign = JSON.parse(buff);

      this.logger.log(`[${messageId}] Received message campaign id=${campaign?.id ?? 'unknown'}`);

      return campaign;
    } catch {
      throw new BadRequestException(`Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `);
    }
  }
}
