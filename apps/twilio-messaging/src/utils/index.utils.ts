import { Injectable } from '@nestjs/common';
import { Account, Contact, CustomFields, MapVariables } from '../interfaces';

@Injectable()
export class Utils {
  stripString(text: string) {
    return text.replace(/(<([^>]+)>)/gi, '');
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
    };

    for (const customField of customFields) {
      const customFieldName = (customField?.name || customField) as string;
      variables[customFieldName] = `%${customFieldName.toUpperCase()}%`;
    }

    return variables;
  }

  parseVariables(content: string, contact: Contact, account: Account): string {
    if (!this.hasVariable(content)) {
      return content;
    }

    const mapVariables = this.mapVariables(contact, account, false);
    const mapVariablesKeys = Object.keys(mapVariables);

    for (const variable of mapVariablesKeys) {
      const variableRegex = new RegExp(variable, 'gim');
      content = content.replace(variableRegex, mapVariables[variable]);
    }

    return content;
  }

  hasVariable(emailContent: string): boolean {
    return emailContent ? emailContent.includes('%') : false;
  }

  mapVariables(contact: Contact, account: Account, replaceLinks: any, onlyKeyName = false): MapVariables {
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

  getCustomFieldContact(contact: Contact, key: string) {
    if (!contact.customFields || Object.keys(contact.customFields).length < 1) {
      return '';
    }

    const fieldKey = Object.keys(contact.customFields).find((customField) => customField === key);
    return contact.customFields[fieldKey] || '';
  }
}
