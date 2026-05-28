import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// The evo-academy BMS pixel ships the api key inside the JSON body
// (`{ contact, apiKey, tagName }`), not as a header. Copy it into
// `x-api-key` before PrincipalContextGuard runs so the existing auth
// path resolves the account and populates CLS — no @PublicRoute, no
// manual cls.set, same audit trail as any other api-key request.
@Injectable()
export class BmsLeadsAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const bodyApiKey = (req.body as { apiKey?: unknown } | undefined)?.apiKey;
    if (typeof bodyApiKey === 'string' && bodyApiKey.length > 0 && !req.headers['x-api-key'] && !req.headers['api-key']) {
      req.headers['x-api-key'] = bodyApiKey;
    }
    next();
  }
}
