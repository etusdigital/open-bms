import { BadRequestException } from '@nestjs/common';
import { Utils } from './index.utils';
import { PubSubMessage } from '../interfaces';

describe('Utils', () => {
  let utils: Utils;

  beforeEach(() => {
    utils = new Utils();
  });

  describe('stripString', () => {
    it('should remove HTML tags', () => {
      expect(utils.stripString('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should return plain text unchanged', () => {
      expect(utils.stripString('Hello World')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(utils.stripString('')).toBe('');
    });
  });

  describe('parsePubSubMessage', () => {
    it('should parse valid base64 encoded data', () => {
      const payload = { foo: 'bar', num: 42 };
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
      const message: PubSubMessage = {
        subscription: 'sub-1',
        message: {
          data: encoded,
          attributes: {},
          messageId: '123',
          message_id: '123',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
        },
      };
      expect(utils.parsePubSubMessage(message)).toEqual(payload);
    });

    it('should throw BadRequestException for invalid data', () => {
      const message: PubSubMessage = {
        subscription: 'sub-1',
        message: {
          data: 'not-valid-base64-json!!!',
          attributes: {},
          messageId: '123',
          message_id: '123',
          publishTime: new Date().toISOString(),
          publish_time: new Date().toISOString(),
        },
      };
      expect(() => utils.parsePubSubMessage(message)).toThrow(BadRequestException);
    });
  });

  describe('getVariables', () => {
    it('should return default variables with no custom fields', () => {
      const vars = utils.getVariables([]);
      expect(vars).toHaveProperty('name', '%NAME%');
      expect(vars).toHaveProperty('firstName', '%FIRSTNAME%');
      expect(vars).toHaveProperty('lastName', '%LASTNAME%');
      expect(vars).toHaveProperty('email', '%EMAIL%');
      expect(vars).toHaveProperty('phone', '%PHONE%');
      expect(vars).toHaveProperty('uuid', '%UUID%');
    });

    it('should include custom fields', () => {
      const customFields = [{ id: 1, accountId: 1, title: 'Company', name: 'company', description: '', order: 1 }];
      const vars = utils.getVariables(customFields);
      expect(vars).toHaveProperty('company', '%COMPANY%');
    });

    it('should handle custom fields without name property (string-like)', () => {
      const customFields = ['field1' as any];
      const vars = utils.getVariables(customFields);
      expect(vars).toHaveProperty('field1', '%FIELD1%');
    });
  });

  describe('hasVariable', () => {
    it('should return true when content has %', () => {
      expect(utils.hasVariable('Hello %NAME%')).toBe(true);
    });

    it('should return false when content has no %', () => {
      expect(utils.hasVariable('Hello World')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(utils.hasVariable(null as any)).toBe(false);
      expect(utils.hasVariable(undefined as any)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(utils.hasVariable('')).toBe(false);
    });
  });

  describe('parseVariables', () => {
    it('should replace variables in content', () => {
      const contact = { token: 'tk', firstName: 'John', lastName: 'Doe', email: 'john@test.com' };
      const account = { customFields: [] } as any;
      const result = utils.parseVariables('Hello %FIRSTNAME% %LASTNAME%', contact, account);
      expect(result).toBe('Hello John Doe');
    });

    it('should return content unchanged if no variables', () => {
      const contact = { token: 'tk', firstName: 'John' };
      const account = { customFields: [] } as any;
      const result = utils.parseVariables('Hello World', contact, account);
      expect(result).toBe('Hello World');
    });

    it('should replace with empty string for missing contact fields', () => {
      const contact = { token: 'tk' };
      const account = { customFields: [] } as any;
      const result = utils.parseVariables('Hello %FIRSTNAME%', contact, account);
      expect(result).toBe('Hello ');
    });
  });

  describe('mapVariables', () => {
    it('should map contact fields to variables', () => {
      const contact = {
        token: 'tk',
        name: 'John',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@test.com',
        hashedEmail: 'hashed',
        phone: '+5511999',
        uuid: 'uuid-123',
      };
      const account = { customFields: [] } as any;
      const result = utils.mapVariables(contact, account, {});
      expect(result['%NAME%']).toBe('John');
      expect(result['%FIRSTNAME%']).toBe('John');
      expect(result['%LASTNAME%']).toBe('Doe');
      expect(result['%EMAIL%']).toBe('john@test.com');
      expect(result['%UUID%']).toBe('uuid-123');
    });

    it('should handle replaceLinks', () => {
      const contact = { token: 'tk', uuid: 'uuid-123' };
      const account = { customFields: [] } as any;
      const replaceLinks = {
        LINK1: { url: 'https://example.com?a=1', host: 'example.com' },
      };
      const result = utils.mapVariables(contact, account, replaceLinks);
      expect(result['%LINK1%']).toContain('https://bmsclick.example.com/redirect?url=');
    });

    it('should use {{UUID}} fallback when contact has no uuid', () => {
      const contact = { token: 'tk' };
      const account = { customFields: [] } as any;
      const replaceLinks = {
        LINK1: { url: 'https://example.com', host: 'example.com' },
      };
      const result = utils.mapVariables(contact, account, replaceLinks);
      expect(result['%LINK1%']).toContain('bmsclick.example.com/redirect?url=');
      // The URL is base64-encoded, so decode and check for {{UUID}}
      const base64Part = result['%LINK1%'].split('url=')[1];
      const decoded = Buffer.from(base64Part, 'base64').toString();
      expect(decoded).toContain('bmsu={{UUID}}');
    });

    it('should handle onlyKeyName option', () => {
      const contact = { token: 'tk', firstName: 'John' };
      const account = { customFields: [] } as any;
      const result = utils.mapVariables(contact, account, {}, true);
      expect(result).toHaveProperty('FIRSTNAME');
      expect(result).not.toHaveProperty('%FIRSTNAME%');
    });

    it('should map custom fields from contact', () => {
      const contact = {
        token: 'tk',
        customFields: { company: 'Acme' } as any,
      };
      const account = {
        customFields: [{ id: 1, accountId: 1, title: 'Company', name: 'company', description: '', order: 1 }],
      } as any;
      const result = utils.mapVariables(contact, account, {});
      expect(result['%COMPANY%']).toBe('Acme');
    });

    it('should handle contact with link field', () => {
      const contact = { token: 'tk', link: 'https://mylink.com' };
      const account = { customFields: [] } as any;
      const result = utils.mapVariables(contact, account, {});
      expect(result['%LINK%']).toBe('https://mylink.com');
    });

    it('should fallback to custom field link when contact.link is undefined', () => {
      const contact = { token: 'tk', customFields: { link: 'https://cflink.com' } as any };
      const account = { customFields: [] } as any;
      const result = utils.mapVariables(contact, account, {});
      expect(result['%LINK%']).toBe('https://cflink.com');
    });
  });

  describe('getCustomFieldContact', () => {
    it('should return value for existing custom field', () => {
      const contact = { token: 'tk', customFields: { company: 'Acme' } as any };
      expect(utils.getCustomFieldContact(contact, 'company')).toBe('Acme');
    });

    it('should return empty string for missing custom field', () => {
      const contact = { token: 'tk', customFields: { company: 'Acme' } as any };
      expect(utils.getCustomFieldContact(contact, 'missing')).toBe('');
    });

    it('should return empty string when customFields is undefined', () => {
      const contact = { token: 'tk' };
      expect(utils.getCustomFieldContact(contact, 'any')).toBe('');
    });

    it('should return empty string when customFields is empty', () => {
      const contact = { token: 'tk', customFields: {} as any };
      expect(utils.getCustomFieldContact(contact, 'any')).toBe('');
    });
  });
});
