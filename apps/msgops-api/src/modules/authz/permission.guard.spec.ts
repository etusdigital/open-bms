import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalContext } from './authz.types';

jest.mock('./authz.service', () => ({
  AuthzService: jest.fn(),
}));

import { PermissionGuard } from './permission.guard';

function createMockContext(authzContext?: PrincipalContext, metadata?: Record<string, unknown>) {
  const handler = () => {};
  const cls = () => {};

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      Reflect.defineMetadata(key, value, handler);
    }
  }

  return {
    switchToHttp: () => ({
      getRequest: () => ({ authzContext }),
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as any;
}

function createGuard(hasPermissions = true) {
  const reflector = new Reflector();
  const cls = { set: jest.fn() } as any;
  const authzService = { hasPermissions: jest.fn().mockReturnValue(hasPermissions) } as any;
  return new PermissionGuard(reflector, cls, authzService);
}

function superAdminContext(overrides: Partial<PrincipalContext> = {}): PrincipalContext {
  return {
    principalType: 'user',
    principalId: 1,
    userId: 1,
    accountId: 1,
    globalRole: 'super_admin',
    effectiveRole: 'super_admin',
    permissions: [],
    isSuperAdmin: true,
    ...overrides,
  };
}

function regularUserContext(overrides: Partial<PrincipalContext> = {}): PrincipalContext {
  return {
    principalType: 'user',
    principalId: 2,
    userId: 2,
    accountId: 1,
    globalRole: 'admin',
    effectiveRole: 'admin',
    permissions: ['infra:view', 'infra:manage'],
    isSuperAdmin: false,
    ...overrides,
  };
}

describe('PermissionGuard – RequireSuperAdmin', () => {
  it('allows super admin when @RequireSuperAdmin is set', () => {
    const guard = createGuard();
    const context = createMockContext(superAdminContext(), { requireSuperAdmin: true });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects non-super-admin when @RequireSuperAdmin is set', () => {
    const guard = createGuard();
    const context = createMockContext(regularUserContext(), { requireSuperAdmin: true });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects unauthenticated request when @RequireSuperAdmin is set', () => {
    const guard = createGuard();
    const context = createMockContext(undefined, { requireSuperAdmin: true });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('falls through to permission check when @RequireSuperAdmin is not set', () => {
    const guard = createGuard(true);
    const context = createMockContext(regularUserContext(), { requiredPermissions: ['infra:view'] });

    expect(guard.canActivate(context)).toBe(true);
  });
});
