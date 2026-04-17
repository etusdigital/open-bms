import { HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { RedisService } from '../providers/redis.provider';
import { Email, EmailPriority } from '../modules/services/services.dto';
import { Contact } from '../modules/services/services.dto';
import { JSDOM } from 'jsdom';
import { ClsService } from 'nestjs-cls';
@Injectable()
export class UtilsService {
  constructor(private readonly redisService: RedisService) {}

  accentsMap = {
    a: 'á|à|ã|â|À|Á|Ã|Â',
    e: 'é|è|ê|É|È|Ê',
    i: 'í|ì|î|Í|Ì|Î',
    o: 'ó|ò|ô|õ|Ó|Ò|Ô|Õ',
    u: 'ú|ù|û|ü|Ú|Ù|Û|Ü',
    c: 'ç|Ç',
    n: 'ñ|Ñ',
  };

  replaceSpecialChars(term: string) {
    return term
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/([^\w]+|\s+)/g, '-') // Substitui espaço e outros caracteres por hífen
      .replace(/--+/g, '-') // Substitui multiplos hífens por um único hífen
      .replace(/(^-+|-+$)/, '') // Remove hífens extras do final ou do inicio da string
      .replace(/_/g, '-') // Replace underscore for dash
      .toLowerCase();
  }

  slugify(text: string) {
    if (!text) return '';
    return Object.keys(this.accentsMap).reduce((acc, cur) => acc.replace(new RegExp(this.accentsMap[cur], 'g'), cur), text);
  }

  normalizeString(text: string) {
    return this.slugify(text).toLowerCase().replace(/\s/g, '-');
  }

  async deleteCache(key: string | Array<string>) {
    const redisClient = await this.redisService.getClient();
    if (Array.isArray(key)) {
      await redisClient.del(...key);
    } else {
      await redisClient.del(key);
    }
  }
}

@Injectable()
export class ValidLinksService {
  constructor(
    private readonly httpService: HttpService,
    private readonly cls: ClsService,
  ) {}

  async validLinks(html) {
    const dom: JSDOM = await new JSDOM(html);
    const {
      window: { document },
    } = dom;
    const links = document.querySelectorAll('a');
    const urlsToCheck = new Set<string>();

    // Collect all unique URLs to check
    for (const link of links) {
      if (link.href && !link.href.includes('unsubscribe_link')) {
        try {
          const urlsRandom = JSON.parse(link.href);
          if (Array.isArray(urlsRandom)) {
            urlsRandom.forEach((url) => urlsToCheck.add(url));
          } else {
            const finalHref = link.href.replace(/%.*?%/g, '');
            urlsToCheck.add(decodeURIComponent(finalHref));
          }
        } catch {
          const finalHref = link.href.replace(/%.*?%/g, '');
          urlsToCheck.add(decodeURIComponent(finalHref));
        }
      }
    }

    // Convert Set to Array for Promise.all
    const urlsArray = Array.from(urlsToCheck);

    // Create an array of promises that resolve to {url, isValid}
    const promises = urlsArray.map(async (url) => {
      const isValid = await this.getLink(url);
      return { url, isValid };
    });

    // Wait for all promises to resolve
    const results = await Promise.all(promises);
    return results.filter((result) => !result.isValid).map((result) => result.url);
  }

  async getLink(link: string) {
    try {
      if (/^%[^%]+%$/.test(link) || /^{{.*}}$/.test(link)) {
        return true;
      }

      if (link.includes('#')) {
        return false;
      }

      const domains = process.env.BYPASS_DOMAINS;
      const byPassDomains = domains ? domains.split(',') : [];
      if (!byPassDomains.some((domain) => link.includes(domain))) {
        const validUrl = isValidUrl(link);
        if (!validUrl) {
          return false;
        }
        if (!this.cls.get('isInternalAccount')) {
          return true;
        }

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        };

        const checkHead = await this.httpService.head(link, { headers }).toPromise();
        return checkHead.status < 500 && checkHead.status !== HttpStatus.NOT_FOUND;
      }

      return true;
    } catch (error) {
      if (error.response) {
        return error.response.status < 500 && error.response.status !== HttpStatus.NOT_FOUND;
      }
      return false;
    }
  }
}

export const replaceSpecialChars = (term: string): string => {
  if (!term) {
    return;
  }

  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/([^\w]+|\s+)/g, '-') // Substitui espaço e outros caracteres por hífen
    .replace(/--+/g, '-') // Substitui multiplos hífens por um único hífen
    .replace(/(^-+|-+$)/, '') // Remove hífens extras do final ou do inicio da string
    .toLowerCase();
};

export const isValidCharacters = (value: any) => {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const isEmojiRegex = emojiRegex.test(value);
  if (isEmojiRegex) {
    return false;
  }

  // accept placeholders
  if (/^%[a-zA-Z0-9_-]*%$/g.test(value)) {
    return true;
  }

  const invalidCharacters = [
    `+`,
    `±`,
    `×`,
    `÷`,
    `%`,
    `‰`,
    `=`,
    `≠`,
    `≈`,
    `≡`,
    `<`,
    `>`,
    `≤`,
    `≥`,
    `∞`,
    `⅛`,
    `¼`,
    `⅜`,
    `½`,
    `⅝`,
    `¾`,
    `⅞`,
    `∫`,
    `∂`,
    `∆`,
    `∏`,
    `∑`,
    `√`,
    `∟`,
    `∩`,
    `∙`,
    `ƒ`,
    `⁄`,
    `$`,
    `€`,
    `£`,
    `¥`,
    `¢`,
    `₣`,
    `₤`,
    `₧`,
    `¤`,
    `%`,
    `‰`,
    `"`,
    `#`,
    `&`,
    `*`,
    `,`,
    `-`,
    `.`,
    `/`,
    `@`,
    `^`,
    `_`,
    `{`,
    `|`,
    `}`,
    `~`,
    `„`,
    `…`,
    `†`,
    `‡`,
    `‹`,
    `'`,
    `'`,
    `"`,
    `"`,
    `•`,
    `–`,
    `—`,
    `™`,
    `›`,
    `\u00A0`,
    `¦`,
    `©`,
    `ª`,
    `«`,
    `¬`,
    `­`,
    `®`,
    `°`,
    `²`,
    `³`,
    `µ`,
    `¶`,
    `·`,
    `¹`,
    `º`,
    `»`,
    `℅`,
    `ⁿ`,
    `§`,
    `¨`,
    `―`,
    `‣`,
    `‾`,
    `‼`,
    `№`,
  ];

  const isCharacters = invalidCharacters.filter((item: string) => value.includes(item));
  if (isCharacters && isCharacters.length) {
    return false;
  }
  return true;
};

export const hasEmojiCharacters = (value: any) => {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return emojiRegex.test(value);
};

export const parseMessageToSendEmail = (message: any, account, contact: Contact) => {
  const email: Email = {
    id: message.id,
    title: message.title,
    name: message.name,
    previewText: message.previewText,
    ippool: message.ippool,
    subject: message.subject,
    replyTo: message.replyTo,
    priority: message.priority || EmailPriority.NORMAL,
    content: message.content,
    providerMessageId: message.providerMessageId,
    location: {
      bucketName: message.bucketName,
      fileName: message.fileName,
    },
    from: {
      firstName: message.fromName,
      email: message.fromMail,
    },
  };

  return {
    account: account || {},
    automationType: 'transactional',
    contact: { ...contact },
    message: email,
    next: {},
  };
};

export const isValidUrl = (urlString: string) => {
  const trimmed = urlString.trim();
  try {
    if (/[",]/.test(trimmed)) {
      return false;
    }
    if ((trimmed.match(/:\/\//g) || []).length > 1) {
      return false;
    }
    return Boolean(new URL(trimmed));
  } catch {
    return false;
  }
};

export const formatterEmail = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .normalize('NFC')
    .replace(/@gmail\.com.*$/, '@gmail.com');
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};
