import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import * as requestIp from 'request-ip';
import { Request } from 'express';

export const IpAddress = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (request.clientIp) return request.clientIp;
  return requestIp.getClientIp(request as requestIp.Request);
});
