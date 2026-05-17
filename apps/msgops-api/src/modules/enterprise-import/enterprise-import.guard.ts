import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

// Module gate: if ENTERPRISE_IMPORT_ENABLED != 'true', all routes return 404
// (module invisible externally). Applied as a local guard on the controller —
// an APP_GUARD alternative would be too global.
@Injectable()
export class EnterpriseImportEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.ENTERPRISE_IMPORT_ENABLED === 'true') return true;
    throw new NotFoundException();
  }
}
