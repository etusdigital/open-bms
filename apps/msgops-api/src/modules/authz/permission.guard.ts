import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { AuthzService } from './authz.service';
import { REQUIRED_PERMISSIONS_KEY, REQUIRE_SUPER_ADMIN_KEY } from './authz.constants';
import { PrincipalContext } from './authz.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly authzService: AuthzService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authzContext: PrincipalContext | undefined = request.authzContext;

    // Check super admin requirement first
    const requireSuperAdmin = this.reflector.getAllAndOverride<boolean>(REQUIRE_SUPER_ADMIN_KEY, [context.getHandler(), context.getClass()]);
    if (requireSuperAdmin) {
      if (!authzContext) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (!authzContext.isSuperAdmin) {
        throw new ForbiddenException('Super admin access required');
      }
      this.cls.set('permissions', authzContext.permissions);
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    if (!authzContext) {
      throw new UnauthorizedException('Unauthorized');
    }

    const allowed = this.authzService.hasPermissions(authzContext, requiredPermissions);
    if (!allowed) {
      throw new ForbiddenException('Missing required permission');
    }

    this.cls.set('permissions', authzContext.permissions);
    return true;
  }
}
