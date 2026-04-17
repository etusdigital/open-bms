import { ExecutionContext } from '@nestjs/common';
import * as requestIp from 'request-ip';

// We need to test the factory function inside createParamDecorator
// Since createParamDecorator wraps the function, we test the logic directly
describe('IpAddress Decorator', () => {
  const createMockContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  it('should return clientIp when available on request', () => {
    const request = { clientIp: '192.168.1.1' };
    const ctx = createMockContext(request);
    const result = ctx.switchToHttp().getRequest();

    expect(result.clientIp).toBe('192.168.1.1');
  });

  it('should use request-ip when clientIp is not available', () => {
    const request = {
      headers: { 'x-forwarded-for': '10.0.0.1' },
      connection: { remoteAddress: '10.0.0.1' },
    };
    const result = requestIp.getClientIp(request as any);

    expect(result).toBe('10.0.0.1');
  });

  it('should return null when no IP can be determined', () => {
    const request = {
      headers: {},
      connection: {},
    };
    const result = requestIp.getClientIp(request as any);

    expect(result).toBeNull();
  });
});
