// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setupHttpClient, setupGateway } from '../setup-gateway';

describe('setup-gateway', () => {
  let postSpy: ReturnType<typeof vi.spyOn>;
  let getSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postSpy = vi.spyOn(__setupHttpClient, 'post');
    getSpy = vi.spyOn(__setupHttpClient, 'get');
  });

  it('http client has no request interceptors registered (auth-free)', () => {
    // The interceptor manager exposes its handler list via a private array
    // accessible only by index. We inspect it indirectly by counting.
    const reqHandlers = (__setupHttpClient.interceptors.request as unknown as { handlers: unknown[] }).handlers;
    const resHandlers = (__setupHttpClient.interceptors.response as unknown as { handlers: unknown[] }).handlers;

    expect(reqHandlers.length).toBe(0);
    expect(resHandlers.length).toBe(0);
  });

  it('getStatus() hits GET /setup/status', async () => {
    getSpy.mockResolvedValueOnce({ data: { configured: false, currentStep: 1 } });
    const s = await setupGateway.getStatus();
    expect(s.configured).toBe(false);
    expect(getSpy).toHaveBeenCalledWith('/setup/status');
  });

  it('healthCheck() hits GET /setup/health-check', async () => {
    getSpy.mockResolvedValueOnce({ data: { allOk: true } });
    await setupGateway.healthCheck();
    expect(getSpy).toHaveBeenCalledWith('/setup/health-check');
  });

  it('advanceStep(): wraps step + data in the body', async () => {
    postSpy.mockResolvedValueOnce({ data: undefined });
    await setupGateway.advanceStep({ step: 1, data: { name: 'A', email: 'a@b.c', password: 'password1' } });
    expect(postSpy).toHaveBeenCalledWith('/setup/advance', {
      step: 1,
      data: { name: 'A', email: 'a@b.c', password: 'password1' },
    });
  });

  it('testSmtp(): POSTs the payload to /setup/test-smtp', async () => {
    postSpy.mockResolvedValueOnce({ data: undefined });
    const payload = { host: 'h', port: 587, user: 'u', pass: 'p', from: 'f@b.c' };
    await setupGateway.testSmtp(payload);
    expect(postSpy).toHaveBeenCalledWith('/setup/test-smtp', payload);
  });

});
