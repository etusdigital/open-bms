import { BadRequestException, Injectable } from '@nestjs/common';
import { Account, Contact, MapVariables, PubSubMessage, CustomFields } from '../interfaces';
import Handlebars from 'handlebars';

@Injectable()
export class Utils {
  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
  }

  parsePubSubMessage(subscriptionMessage: PubSubMessage) {
    const {
      message: { data },
    } = subscriptionMessage;

    try {
      const buff = Buffer.from(data, 'base64').toString();
      const leadMessage = JSON.parse(buff);

      return leadMessage;
    } catch (_error) {
      throw new BadRequestException(
        `Unable to parse data to Batch. messageId: ${JSON.stringify(subscriptionMessage)} `
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
      text
    );
  }

  breakArrayInChunks(array: any[], size: number): any[] {
    if (size < 1) {
      return array;
    }

    const chunk = [];
    for (let index = 0; index < array.length; index += size) {
      chunk.push(array.slice(index, index + size));
    }

    return chunk;
  }

  createQueryParams(o: Record<string, string | number>) {
    if (o == null || o == undefined) return '';

    return Object.keys(o)
      .map((key) => key + '=' + o[key])
      .join('&');
  }

  getDomainFromUrl(link: string): string {
    const url = new URL(link);
    return url.host;
  }

  getVariables(customFields: CustomFields[]) {
    const variables = {
      name: '%NAME%',
      firstName: '%FIRSTNAME%',
      lastName: '%LASTNAME%',
      fullName: '%FULLNAME%',
      email: '%EMAIL%',
      hashedEmail: '%HASHEDEMAIL%',
      uuid: '%UUID%',
      phone: '%PHONE%',
      link: '%LINK%',
      dateToday: '%DATE_TODAY%',
      dateTomorrow: '%DATE_TOMORROW%',
      dayWeekToday: '%DAY_OF_WEEK_TODAY%',
      dayWeekTomorrow: '%DAY_OF_WEEK_TOMORROW%',
      monthToday: '%MONTH_TODAY%',
      monthNext: '%MONTH_NEXT%',
      hourNow: '%HOUR_NOW%',
      hourNextHour: '%HOUR_NEXT_HOUR%',
      hourNext8Hours: '%HOUR_NEXT_8_HOUR%',
      hourNext16Hours: '%HOUR_NEXT_16_HOUR%',
      hourNext23Hours: '%HOUR_NEXT_23_HOUR%',
    };

    for (const customField of customFields) {
      const customFieldName = (customField?.name || customField) as string;
      variables[customFieldName] = `%${customFieldName.toUpperCase()}%`;
    }

    return variables;
  }

  parseVariables(content: string, contact: Contact, account: Account, language: string, timeZone: string): string {
    if (!this.hasVariable(content)) {
      return content;
    }

    const mapVariables = this.mapVariables(contact, account, false, language, timeZone);
    const mapVariablesKeys = Object.keys(mapVariables);

    for (const variable of mapVariablesKeys) {
      const variableRegex = new RegExp(variable, 'gim');
      content = content.replace(variableRegex, mapVariables[variable]);
    }

    return content;
  }

  parseContent(content: string, contact: Contact, account: Account, language: string, timeZone: string) {
    const parsedContent = this.parseVariables(content, contact, account, language, timeZone);
    const context = {
      ...contact,
      ...contact.customFields,
    };
    return this.processHandlebars(parsedContent, context);
  }

  preprocessTemplate(template: string, context: { [x: string]: any }) {
    return template.replace(/{{\s*([^|]+?)\s*\|\s*([^}]+?)\s*}}/g, (match, p1, p2) => {
      return context[p1] != null ? context[p1] : p2;
    });
  }

  processHandlebars(templateSource: any, context: any) {
    const preprocessedTemplate = this.preprocessTemplate(templateSource, context);
    const template = Handlebars.compile(preprocessedTemplate);
    return template(context);
  }

  hasVariable(emailContent: string): boolean {
    return emailContent ? emailContent.includes('%') : false;
  }

  mapVariables(
    contact: Contact,
    account: Account,
    replaceLinks: any,
    language: string,
    timeZone: string,
    onlyKeyName = false
  ): MapVariables {
    const variables: any = this.getVariables(account?.customFields || []);
    const staticVariables = [
      'name',
      'firstName',
      'lastName',
      'fullName',
      'email',
      'hashedEmail',
      'phone',
      'link',
      'uuid',
      'dateToday',
      'dateTomorrow',
      'dayWeekToday',
      'dayWeekTomorrow',
      'monthToday',
      'monthNext',
      'hourNow',
      'hourNextHour',
      'hourNext8Hours',
      'hourNext16Hours',
      'hourNext23Hours',
    ];

    const map: MapVariables = {
      [variables.name]: contact.name || '',
      [variables.firstName]: contact.firstName || '',
      [variables.lastName]: contact.lastName || '',
      [variables.fullName]: contact.fullName || '',
      [variables.email]: contact.email || '',
      [variables.hashedEmail]: contact.hashedEmail || '',
      [variables.phone]: contact.phone || '',
      [variables.uuid]: contact.uuid || '',
      [variables.link]: contact.link || this.getCustomFieldContact(contact, 'link'),
    };

    for (const link of Object.keys(replaceLinks)) {
      const uuid = contact?.uuid || '{{UUID}}';
      const bmsUrl = Buffer.from(`${replaceLinks[link].url}&bmsu=${uuid}`).toString('base64');
      map[`%${link}%`] = `https://bmsclick.${replaceLinks[link].host}/redirect?url=${bmsUrl}`;
    }

    for (const variable of Object.keys(variables)) {
      if (!staticVariables.includes(variable)) {
        map[variables[variable]] = this.getCustomFieldContact(contact, variable);
      } else if (
        variable.includes('hour') ||
        variable.includes('date') ||
        variable.includes('day') ||
        variable.includes('month')
      ) {
        map[variables[variable]] = this.getDateFormatted(variable, language, timeZone);
      }
    }

    if (onlyKeyName) {
      const newMap = {};

      Object.keys(map).forEach((key) => {
        newMap[key.replace(/%/g, '')] = map[key];
      });

      return newMap;
    }

    return map;
  }

  getDateFormatted(typeDate: string, language: string, timeZone: string) {
    const dateFormatTemplate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const weekDayFormatTemplate: Intl.DateTimeFormatOptions = { weekday: 'long' };
    const monthFormatTemplate: Intl.DateTimeFormatOptions = { month: 'long' };
    const hourFormatTemplate: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    let actualTemplate: Intl.DateTimeFormatOptions;
    const today = new Date();

    if (typeDate.includes('Tomorrow')) {
      today.setDate(today.getDate() + 1);
    } else if (typeDate === 'monthNext') {
      today.setMonth(today.getMonth() + 1);
    } else if (typeDate.includes('Next') && typeDate.includes('hour')) {
      const quant = typeDate.match(/\d+/g) ? parseInt(typeDate.match(/\d+/g).join(''), 10) : 1;
      today.setHours(today.getHours() + quant);
    }

    if (typeDate.includes('month')) {
      actualTemplate = monthFormatTemplate;
    } else if (typeDate.includes('date')) {
      actualTemplate = dateFormatTemplate;
    } else if (typeDate.includes('dayWeek')) {
      actualTemplate = weekDayFormatTemplate;
    } else if (typeDate.includes('hour')) {
      actualTemplate = hourFormatTemplate;
    }

    return today.toLocaleString(language, { ...actualTemplate, timeZone });
  }

  getCustomFieldContact(contact: Contact, key: string) {
    if (!contact.customFields || Object.keys(contact.customFields).length < 1) {
      return '';
    }

    const fieldKey = Object.keys(contact.customFields).find((customField) => customField === key);
    return contact.customFields[fieldKey] || '';
  }
}
