import { Utils } from './index.utils';

describe('Utils', () => {
  let utils: Utils;

  beforeEach(() => {
    utils = new Utils();
  });

  describe('stripString', () => {
    it('should remove HTML tags from text', () => {
      expect(utils.stripString('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should return plain text unchanged', () => {
      expect(utils.stripString('Hello World')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(utils.stripString('')).toBe('');
    });
  });

  describe('hasVariable', () => {
    it('should return true when content contains %', () => {
      expect(utils.hasVariable('Hello %NAME%')).toBe(true);
    });

    it('should return false when content has no %', () => {
      expect(utils.hasVariable('Hello World')).toBe(false);
    });

    it('should return false for null/undefined content', () => {
      expect(utils.hasVariable(null)).toBe(false);
      expect(utils.hasVariable(undefined)).toBe(false);
    });
  });

  describe('getVariables', () => {
    it('should return default variables with no custom fields', () => {
      const vars = utils.getVariables([]);
      expect(vars.name).toBe('%NAME%');
      expect(vars.firstName).toBe('%FIRSTNAME%');
      expect(vars.email).toBe('%EMAIL%');
      expect(vars.phone).toBe('%PHONE%');
      expect(vars.uuid).toBe('%UUID%');
    });

    it('should include custom fields as variables', () => {
      const customFields = [{ id: 1, accountId: 1, title: 'Company', name: 'company', description: '', order: 1 }];
      const vars = utils.getVariables(customFields);
      expect((vars as any).company).toBe('%COMPANY%');
    });
  });

  describe('getCustomFieldContact', () => {
    it('should return custom field value when found', () => {
      const contact = { customFields: { company: 'Acme' }, token: 't' };
      expect(utils.getCustomFieldContact(contact as any, 'company')).toBe('Acme');
    });

    it('should return empty string when custom field not found', () => {
      const contact = { customFields: { company: 'Acme' }, token: 't' };
      expect(utils.getCustomFieldContact(contact as any, 'nonexistent')).toBe('');
    });

    it('should return empty string when contact has no custom fields', () => {
      const contact = { customFields: null, token: 't' };
      expect(utils.getCustomFieldContact(contact as any, 'company')).toBe('');
    });

    it('should return empty string when customFields is empty', () => {
      const contact = { customFields: {}, token: 't' };
      expect(utils.getCustomFieldContact(contact as any, 'company')).toBe('');
    });
  });

  describe('parseVariables', () => {
    it('should return content unchanged when no variables present', () => {
      const contact = { name: 'John', token: 't' };
      const account = { id: 1 };
      const result = utils.parseVariables('Hello World', contact as any, account as any);
      expect(result).toBe('Hello World');
    });

    it('should replace variables with contact data', () => {
      const contact = { name: 'John', firstName: 'John', lastName: 'Doe', email: 'john@test.com', token: 't' };
      const account = { id: 1, customFields: [] };
      const result = utils.parseVariables('Hello %FIRSTNAME% %LASTNAME%', contact as any, account as any);
      expect(result).toBe('Hello John Doe');
    });
  });

  describe('mapVariables', () => {
    it('should map static contact fields to variable placeholders', () => {
      const contact = {
        name: 'John',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@test.com',
        hashedEmail: 'hash123',
        phone: '+5511999999999',
        uuid: 'uuid-1',
        token: 't',
      };
      const account = { id: 1, customFields: [] };

      const map = utils.mapVariables(contact as any, account as any, {});
      expect(map['%FIRSTNAME%']).toBe('John');
      expect(map['%LASTNAME%']).toBe('Doe');
      expect(map['%EMAIL%']).toBe('john@test.com');
    });

    it('should include link replacement URLs', () => {
      const contact = { uuid: 'uuid-1', token: 't' };
      const account = { id: 1, customFields: [] };
      const replaceLinks = {
        LINK1: { url: 'https://example.com?ref=1', host: 'example.com' },
      };

      const map = utils.mapVariables(contact as any, account as any, replaceLinks);
      expect(map['%LINK1%']).toContain('bmsclick.example.com/redirect');
    });

    it('should return key names without % when onlyKeyName is true', () => {
      const contact = { name: 'John', firstName: 'John', token: 't' };
      const account = { id: 1, customFields: [] };

      const map = utils.mapVariables(contact as any, account as any, {}, true);
      expect(map['FIRSTNAME']).toBe('John');
      expect(map['%FIRSTNAME%']).toBeUndefined();
    });
  });
});
