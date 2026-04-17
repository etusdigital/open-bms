import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

describe('ThrottlerBehindProxyGuard', () => {
  let guard: ThrottlerBehindProxyGuard;

  beforeEach(() => {
    // Create guard instance; parent constructor needs dependencies but we only test getTracker
    guard = Object.create(ThrottlerBehindProxyGuard.prototype);
  });

  describe('getTracker()', () => {
    it('should return clientIp when available on request', async () => {
      const req = { clientIp: '1.2.3.4' };
      const result = await (guard as any).getTracker(req);
      expect(result).toBe('1.2.3.4');
    });

    it('should fall back to request-ip when clientIp is not set', async () => {
      const req = {
        headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
        connection: {},
      };
      const result = await (guard as any).getTracker(req);
      expect(result).toBe('5.6.7.8');
    });

    it('should return null when no IP information is available', async () => {
      const req = { headers: {}, connection: {} };
      const result = await (guard as any).getTracker(req);
      expect(result).toBeNull();
    });

    it('should handle a single IP in X-Forwarded-For', async () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        connection: {},
      };
      const result = await (guard as any).getTracker(req);
      expect(result).toBe('1.2.3.4');
    });
  });
});
