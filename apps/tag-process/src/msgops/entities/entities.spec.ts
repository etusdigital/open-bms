import { AccountEntity } from './account.entity';
import { ContactEntity } from './contact.entity';
import { ContactConditionalEntity } from './contact-conditional.entity';
import { CustomFieldKeyType } from '../../interfaces';

describe('AccountEntity', () => {
  describe('parseAccount', () => {
    it('should reduce accountConfigs array to key-value object', () => {
      const entity = new AccountEntity();
      entity.accountConfigs = [
        { accountId: 1, name: 'api_key', value: 'key123', description: '' },
        { accountId: 1, name: 'time_zone', value: 'UTC', description: '' },
      ] as any;
      entity.customFields = [{ name: 'field1' }, { name: 'field2' }] as any;

      entity.parseAccount();

      expect(entity.accountConfigs).toEqual({ api_key: 'key123', time_zone: 'UTC' });
      expect(entity.customFields).toEqual(['field1', 'field2']);
    });

    it('should handle empty arrays', () => {
      const entity = new AccountEntity();
      entity.accountConfigs = [] as any;
      entity.customFields = [] as any;

      entity.parseAccount();

      expect(entity.accountConfigs).toEqual({});
      expect(entity.customFields).toEqual([]);
    });
  });
});

describe('ContactEntity', () => {
  describe('parseCustomFields', () => {
    it('should parse customFields array into key-value object', () => {
      const entity = new ContactEntity();
      entity.customFields = [
        { customFieldType: { name: 'company' }, value: 'Acme' },
        { customFieldType: { name: 'role' }, value: 'Admin' },
      ] as any;
      entity.tags = [{ tag: { name: 'tag1' } }, { tag: { name: 'tag2' } }] as any;
      entity.firstName = 'John';
      entity.lastName = 'Doe';

      entity.parseCustomFields();

      expect(entity.customFields).toEqual({ company: 'Acme', role: 'Admin' });
      expect(entity.tags).toEqual(['tag1', 'tag2']);
      expect(entity.fullName).toBe('John Doe');
    });

    it('should handle missing customFieldType', () => {
      const entity = new ContactEntity();
      entity.customFields = [{ customFieldType: null, value: 'Acme' }] as any;
      entity.tags = [] as any;
      entity.firstName = 'Jane';
      entity.lastName = null;

      entity.parseCustomFields();

      expect(entity.customFields).toEqual({});
      expect(entity.fullName).toBe('Jane');
    });

    it('should handle tags with missing tag property', () => {
      const entity = new ContactEntity();
      entity.customFields = [] as any;
      entity.tags = [{ tag: null }, { tag: { name: 'tag1' } }] as any;
      entity.firstName = 'Test';
      entity.lastName = '';

      entity.parseCustomFields();

      expect(entity.tags).toEqual(['', 'tag1']);
    });

    it('should handle non-array customFields (already parsed)', () => {
      const entity = new ContactEntity();
      entity.customFields = { company: 'Acme' } as any;
      entity.tags = 'not-array' as any;
      entity.firstName = 'Test';
      entity.lastName = '';

      entity.parseCustomFields();

      // Should remain unchanged when not arrays
      expect(entity.customFields).toEqual({ company: 'Acme' });
    });
  });
});

describe('ContactConditionalEntity', () => {
  describe('parseCustomFields', () => {
    it('should parse with NAME key type', () => {
      const entity = new ContactConditionalEntity();
      entity.customFields = [
        { customFieldType: { name: 'company' }, customFieldId: 1, value: 'Acme', number: null, time: null },
      ] as any;
      entity.tags = [{ tagId: 100 }, { tagId: 200 }] as any;

      entity.parseCustomFields(CustomFieldKeyType.NAME);

      expect(entity.customFields).toEqual({ company: 'Acme' });
      expect(entity.tags).toEqual([100, 200]);
    });

    it('should parse with ID key type', () => {
      const entity = new ContactConditionalEntity();
      entity.customFields = [
        { customFieldType: { name: 'company' }, customFieldId: 5, value: 'Test', number: null, time: null },
      ] as any;
      entity.tags = [] as any;

      entity.parseCustomFields(CustomFieldKeyType.ID);

      expect(entity.customFields).toEqual({ 5: 'Test' });
    });

    it('should prefer number over value', () => {
      const entity = new ContactConditionalEntity();
      entity.customFields = [
        { customFieldType: { name: 'score' }, customFieldId: 1, value: 'ignored', number: 42, time: null },
      ] as any;
      entity.tags = [] as any;

      entity.parseCustomFields(CustomFieldKeyType.ID);

      expect(entity.customFields).toEqual({ 1: 42 });
    });

    it('should prefer time over value when number is null', () => {
      const entity = new ContactConditionalEntity();
      entity.customFields = [
        { customFieldType: { name: 'dob' }, customFieldId: 2, value: 'ignored', number: null, time: '2024-01-01' },
      ] as any;
      entity.tags = [] as any;

      entity.parseCustomFields(CustomFieldKeyType.ID);

      expect(entity.customFields).toEqual({ 2: '2024-01-01' });
    });

    it('should handle non-array customFields', () => {
      const entity = new ContactConditionalEntity();
      entity.customFields = { already: 'parsed' } as any;
      entity.tags = 'not-array' as any;

      entity.parseCustomFields(CustomFieldKeyType.ID);

      expect(entity.customFields).toEqual({ already: 'parsed' });
    });
  });
});
