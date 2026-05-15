import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

// Gate global do módulo: se ENTERPRISE_IMPORT_ENABLED != 'true', todas as rotas
// retornam 404 (módulo invisível externamente). Aplicado como guard local no
// controller — manter simples; alternativa via APP_GUARD seria global demais.
@Injectable()
export class EnterpriseImportEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.ENTERPRISE_IMPORT_ENABLED === 'true') return true;
    throw new NotFoundException();
  }
}
