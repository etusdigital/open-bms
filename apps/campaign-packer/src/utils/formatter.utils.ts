import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionMessage } from '../interfaces';

@Injectable()
export class FormatterUtils {
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

      console.log(`[${messageId}] Received message: ${JSON.stringify(campaign)}`);

      return campaign;
    } catch {
      throw new BadRequestException(`Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `);
    }
  }

  logInfo(message: string, args?: any) {
    if (process.env.LOG_LEVEL === 'INFO' || process.env.LOG_LEVEL === 'DEBUG') console.log(message, args || '');
    else return;
  }
}
