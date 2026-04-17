import { Reflector } from '@nestjs/core';
import { AccountsController } from '../accounts.controller';
import { REQUIRED_PERMISSIONS_KEY } from '../../authz/authz.constants';

describe('AccountsController — @RequirePermission metadata', () => {
  const reflector = new Reflector();

  const cases: [string, string[]][] = [
    ['findOne', ['account:settings_view']],
    ['update', ['account:settings_update']],
    ['updateProviders', ['account:settings_update']],
    ['findConfig', ['account:settings_view']],
    ['updateConfig', ['account:settings_update']],
    ['getApiKeysByAccount', ['account:api_keys_view']],
    ['deleteApiKeyByAcoount', ['account:api_keys_revoke']],
    ['requestApiKeyRegen', ['account:api_keys_rotate']],
    ['confirmApiKeyRegen', ['account:api_keys_rotate']],
    ['getApiKeysStatus', ['account:api_keys_view']],
    ['listManagedApiKeys', ['account:api_keys_view']],
    ['createManagedApiKey', ['account:api_keys_create']],
    ['updateManagedApiKey', ['account:api_keys_update_role']],
    ['rotateManagedApiKey', ['account:api_keys_rotate']],
    ['revokeManagedApiKey', ['account:api_keys_revoke']],
  ];

  it.each(cases)('%s requires %j', (methodName, expectedPermissions) => {
    const permissions = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, AccountsController.prototype[methodName]);
    expect(permissions).toEqual(expectedPermissions);
  });

  const unguardedMethods = ['getAllAccounts', 'remove', 'create', 'getSendgridAccounts', 'findAll', 'getConfigs'];

  it.each(unguardedMethods)('%s has NO @RequirePermission (uses inline isSuperAdmin or scoped access)', (methodName) => {
    const permissions = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, AccountsController.prototype[methodName]);
    expect(permissions).toBeUndefined();
  });
});
