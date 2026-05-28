import { UsersController } from './users.controller';
import type { UsersService } from './users.service';
import type { AuthService } from '../auth/auth.service';

function makeController(overrides: Partial<jest.Mocked<UsersService>> = {}) {
  const userService = {
    findOneByProviderId: jest.fn(),
    findOneById: jest.fn(),
    findOneInAccountScope: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<UsersService>;
  const authService = {} as AuthService;
  const controller = new UsersController(userService, authService);
  return { controller, userService };
}

describe('UsersController.findOne (EVO-1461)', () => {
  it('super_admin reaches findOneById even when target has no account memberships', async () => {
    const { controller, userService } = makeController();
    const orphanUser = { id: 42, userAccount: [] };
    (userService.findOneByProviderId as jest.Mock).mockResolvedValue({ id: 1 });
    (userService.findOneById as jest.Mock).mockResolvedValue(orphanUser);

    const result = await controller.findOne(42, { sub: 'local|admin' }, { authzContext: { isSuperAdmin: true } });

    expect(userService.findOneById).toHaveBeenCalledWith(42);
    expect(userService.findOneInAccountScope).not.toHaveBeenCalled();
    expect(result).toBe(orphanUser);
  });

  it('non-super-admin viewing another user routes through account-scoped fetch (F1)', async () => {
    const { controller, userService } = makeController();
    (userService.findOneByProviderId as jest.Mock).mockResolvedValue({ id: 1 });
    (userService.findOneInAccountScope as jest.Mock).mockResolvedValue({ id: 42 });

    await controller.findOne(42, { sub: 'local|user' }, { authzContext: { isSuperAdmin: false, accountId: 5 } });

    // Account admin (isMasterUser irrelevant) must resolve a same-account user via the
    // active-account-scoped path, not the master-id path.
    expect(userService.findOneInAccountScope).toHaveBeenCalledWith(42, 1, 5);
    expect(userService.findOneById).not.toHaveBeenCalled();
  });

  it('self-lookup (id === current user) skips account scoping regardless of role', async () => {
    const { controller, userService } = makeController();
    (userService.findOneByProviderId as jest.Mock).mockResolvedValue({ id: 7 });
    (userService.findOneById as jest.Mock).mockResolvedValue({ id: 7 });

    await controller.findOne(7, { sub: 'local|user' }, { authzContext: { isSuperAdmin: false } });

    expect(userService.findOneById).toHaveBeenCalledWith(7);
    expect(userService.findOneInAccountScope).not.toHaveBeenCalled();
  });
});
