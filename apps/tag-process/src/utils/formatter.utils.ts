import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadMessage, PubSubMessage, TagBatch } from '../interfaces';

@Injectable()
export class FormatterUtils {
  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  parseLead(subscriptionMessage: any): any {
    const {
      message: { data },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      const leadMessage: LeadMessage = JSON.parse(buff);

      return leadMessage;
    } catch (_error) {
      throw new BadRequestException(
        `Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `,
      );
    }
  }

  parseBatch(subscriptionMessage: PubSubMessage): TagBatch {
    const {
      message: { data },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      const tagBatch: TagBatch = JSON.parse(buff);

      return tagBatch;
    } catch (_error) {
      throw new BadRequestException(
        `Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `,
      );
    }
  }

  accentsMap = {
    a: 'á|à|ã|â|À|Á|Ã|Â',
    e: 'é|è|ê|É|È|Ê',
    i: 'í|ì|î|Í|Ì|Î',
    o: 'ó|ò|ô|õ|Ó|Ò|Ô|Õ',
    u: 'ú|ù|û|ü|Ú|Ù|Û|Ü',
    c: 'ç|Ç',
    n: 'ñ|Ñ',
  };

  slugify(text: string) {
    if (!text) return '';
    return Object.keys(this.accentsMap).reduce(
      (acc, cur) => acc.replace(new RegExp(this.accentsMap[cur], 'g'), cur),
      text,
    );
  }
}
