import { Injectable } from '@nestjs/common';
import { AccountConfigEntity } from 'src/msgops/entities/account-config.entity';
import { AccountEntity } from 'src/msgops/entities/account.entity';

@Injectable()
export class FormatterUtils {
  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
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

  cleanUpObjects<T>(object: T): T {
    if (typeof object !== 'object' || object === null) {
      return object;
    }

    if (Array.isArray(object)) {
      const cleanedArray = object.map(this.cleanUpObjects.bind(this));
      const filteredArray = cleanedArray.filter((item) => item !== null && item !== undefined && item !== '');

      if (filteredArray.length === 0) {
        return null as any as T;
      }

      return filteredArray as any as T;
    }

    Object.entries(object).forEach(([key, value]) => {
      let cleanedValue = this.cleanUpObjects(value);
      if (cleanedValue === null || cleanedValue === undefined || cleanedValue === '') {
        delete (object as any)[key];
      } else {
        if (typeof cleanedValue == 'string' && cleanedValue.match(/[\x00-\x1F\x7F]/g)) {
          cleanedValue = cleanedValue.replace(/[\x00-\x1F\x7F]/g, '');
        }
        (object as any)[key] = cleanedValue;
      }
    });

    if (Object.keys(object).length === 0) {
      return null as any as T;
    }

    return object;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  getMailBoxProvider(email: string): string {
    const domain = email.toLowerCase().split('@')[1];

    const gmail = ['gmail.com', 'googlemail.com', 'google.com'];
    if (gmail.includes(domain)) {
      return 'Gmail';
    }

    if (domain.includes('yahoo')) {
      return 'Yahoo';
    }

    const microsoft = ['hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'passport.com'];
    if (microsoft.some((x) => domain.includes(x))) {
      return 'Microsoft';
    }

    const icloud = ['icloud.com', 'me.com', 'mac.com'];
    if (icloud.includes(domain)) {
      return 'iCloud';
    }

    return 'Other';
  }

  toPostgresTimestampWithTimezone(dateString: string): string {
    const date = new Date(dateString);

    return date.toISOString().replace('T', ' ').split('.')[0] + '+00';
  }

  removeQuotes(text: string) {
    return text.replace(/['"]/g, '');
  }

  configByName(account: AccountEntity, name: string): AccountConfigEntity {
    return account.accountConfigs.find((config: AccountConfigEntity) => config.name === name);
  }

  formatterEmail(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .normalize('NFC')
      .replace(/@gmail\.com.*$/, '@gmail.com');
  }

  removeQueryString(url: string) {
    if (!url) {
      return url;
    }

    return url.split('?')[0];
  }
}
