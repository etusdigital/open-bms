import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { AuthzService } from './authz.service';
import { PUBLIC_ROUTE_KEY, CRON_ROUTE_KEY } from './authz.constants';

@Injectable()
export class PrincipalContextGuard implements CanActivate {
  constructor(
    private readonly authzService: AuthzService,
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [context.getHandler(), context.getClass()]);
    const isCron = this.reflector.getAllAndOverride<boolean>(CRON_ROUTE_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest();

    // Cron routes require X-Cron-Secret header
    if (isCron) {
      const cronSecret = request.headers['x-cron-secret'];
      if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
        throw new UnauthorizedException('Invalid or missing cron secret');
      }
      return true;
    }

    try {
      const principalContext = await this.authzService.resolvePrincipalFromRequest(request);

      if (!principalContext) {
        if (isPublic) {
          return true;
        }
        throw new UnauthorizedException('Unauthorized');
      }

      request.authzContext = principalContext;
      this.cls.set('principalType', principalContext.principalType);
      this.cls.set('principalId', principalContext.principalId);
      this.cls.set('userId', principalContext.userId);
      this.cls.set('apiKeyId', principalContext.apiKeyId);
      this.cls.set('accountId', principalContext.accountId);
      this.cls.set('globalRole', principalContext.globalRole);
      this.cls.set('effectiveRole', principalContext.effectiveRole);
      this.cls.set('permissions', principalContext.permissions);
      this.cls.set('isSuperAdmin', principalContext.isSuperAdmin);
      this.cls.set('ipAddress', (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip ?? null);
      this.cls.set('userAgent', request.headers['user-agent'] ?? null);

      return true;
    } catch (error) {
      if (isPublic) {
        return true;
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Unauthorized');
    }
  }
}
