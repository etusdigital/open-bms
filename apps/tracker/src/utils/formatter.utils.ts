import { Injectable } from '@nestjs/common';

@Injectable()
export class FormatterUtils {
  formatterEmail(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .normalize('NFC')
      .replace(/@gmail\.com.*$/, '@gmail.com');
  }
}
