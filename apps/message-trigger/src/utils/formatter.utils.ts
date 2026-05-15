import { BadRequestException, Injectable } from '@nestjs/common';
import { NewMessageDto } from '../dtos/message.dto';
import { LeadStateMessage } from '../interfaces';

@Injectable()
export class FormatterUtils {
  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  parseBase64ToObject(subscriptionMessage: NewMessageDto): LeadStateMessage {
    const {
      message: { data },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      return JSON.parse(buff);
    } catch (error) {
      throw new BadRequestException(`Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `, error);
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
    return Object.keys(this.accentsMap).reduce((acc, cur) => acc.replace(new RegExp(this.accentsMap[cur], 'g'), cur), text);
  }
}
