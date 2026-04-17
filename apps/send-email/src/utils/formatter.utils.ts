import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class FormatterUtils {
  accentsMap = {
    a: 'á|à|ã|â|À|Á|Ã|Â',
    e: 'é|è|ê|É|È|Ê',
    i: 'í|ì|î|Í|Ì|Î',
    o: 'ó|ò|ô|õ|Ó|Ò|Ô|Õ',
    u: 'ú|ù|û|ü|Ú|Ù|Û|Ü',
    c: 'ç|Ç',
    n: 'ñ|Ñ',
  };

  slugify(text: string | number): string {
    if (!text) return '';
    if (typeof text !== 'string') {
      text = text.toString();
    }

    return Object.keys(this.accentsMap).reduce((acc, cur) => acc.replace(new RegExp(this.accentsMap[cur], 'g'), cur), text);
  }

  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  normalizeString(text: string): string {
    return this.replaceSpecialChars(this.slugify(text)).toLowerCase().replace(/\s/g, '-');
  }

  replaceSpecialChars(term: string): string {
    return term
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/([^\w]+|\s+)/g, '-') // Substitui espaço e outros caracteres por hífen
      .replace(/\-\-+/g, '-') // Substitui multiplos hífens por um único hífen
      .replace(/(^-+|-+$)/, '') // Remove hífens extras do final ou do inicio da string
      .toLowerCase();
  }

  parseBase64<T>(data: string | Uint8Array): T {
    try {
      const buff = Buffer.from(data as string, 'base64').toString();
      const dataParsed: T = JSON.parse(buff);

      return dataParsed;
    } catch {
      console.error(`Unable to parse data to Batch. messageId: ${JSON.stringify(data)}`);
      throw new BadRequestException(`Unable to parse data to Batch. messageId: ${JSON.stringify(data)} `);
    }
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
