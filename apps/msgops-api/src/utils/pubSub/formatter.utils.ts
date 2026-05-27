import { BadRequestException, Injectable } from '@nestjs/common';
import { PubSubMessage } from './interfaces';

@Injectable()
export class FormatterUtils {
  parseBatch(subscriptionMessage: PubSubMessage) {
    const {
      message: { data },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      const contact = JSON.parse(buff);

      return contact;
    } catch {
      throw new BadRequestException(`Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `);
    }
  }
}
