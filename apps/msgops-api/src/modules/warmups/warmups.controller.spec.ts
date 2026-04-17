import 'reflect-metadata';
import { REQUIRE_SUPER_ADMIN_KEY } from '../authz/authz.constants';
import { WarmupsController } from './warmups.controller';

describe('WarmupsController – RequireSuperAdmin guard', () => {
  const methods = ['list', 'findOneById', 'create', 'delete'] as const;

  it.each(methods)('%s is decorated with @RequireSuperAdmin()', (method) => {
    const metadata = Reflect.getMetadata(REQUIRE_SUPER_ADMIN_KEY, WarmupsController.prototype[method]);
    expect(metadata).toBe(true);
  });

  it('processTarget is NOT decorated with @RequireSuperAdmin()', () => {
    const metadata = Reflect.getMetadata(REQUIRE_SUPER_ADMIN_KEY, WarmupsController.prototype.processTarget);
    expect(metadata).toBeUndefined();
  });
});
