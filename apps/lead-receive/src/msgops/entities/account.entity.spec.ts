import { AccountEntity } from './account.entity';
import { CustomFieldsEntity } from './custom-fields.entity';

describe('AccountEntity', () => {
  describe('parseCustomFields (AfterLoad)', () => {
    it('should populate customFieldsKeys from customFields', () => {
      const account = new AccountEntity();
      const cf1 = new CustomFieldsEntity();
      cf1.name = 'Company';
      const cf2 = new CustomFieldsEntity();
      cf2.name = 'Role';
      account.customFields = [cf1, cf2];

      account.parseCustomFields();

      expect(account.customFieldsKeys).toEqual(['company', 'role']);
    });

    it('should not populate customFieldsKeys when customFields is undefined', () => {
      const account = new AccountEntity();
      account.customFields = undefined;

      account.parseCustomFields();

      expect(account.customFieldsKeys).toBeUndefined();
    });

    it('should set empty array when customFields is empty', () => {
      const account = new AccountEntity();
      account.customFields = [];

      account.parseCustomFields();

      expect(account.customFieldsKeys).toEqual([]);
    });
  });
});
