import { BmsLeadsAuthMiddleware } from './bms-leads.middleware';

describe('BmsLeadsAuthMiddleware', () => {
  function run(req: any) {
    const middleware = new BmsLeadsAuthMiddleware();
    const next = jest.fn();
    middleware.use(req, {} as any, next);
    return { next };
  }

  it('copies body.apiKey to x-api-key header so PrincipalContextGuard sees it', () => {
    const req: any = { headers: {}, body: { apiKey: 'bms_live_secret_xyz', contact: { email: 'a@b.com' }, tagName: 'evo-hub' } };
    const { next } = run(req);

    expect(req.headers['x-api-key']).toBe('bms_live_secret_xyz');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an existing x-api-key header', () => {
    const req: any = { headers: { 'x-api-key': 'header_wins' }, body: { apiKey: 'body_loses' } };
    run(req);
    expect(req.headers['x-api-key']).toBe('header_wins');
  });

  it('does not overwrite when api-key (legacy header) is already set', () => {
    const req: any = { headers: { 'api-key': 'legacy_header' }, body: { apiKey: 'body_loses' } };
    run(req);
    expect(req.headers['x-api-key']).toBeUndefined();
    expect(req.headers['api-key']).toBe('legacy_header');
  });

  it('ignores a missing body (e.g. wrong content-type, no parser ran)', () => {
    const req: any = { headers: {} };
    const { next } = run(req);
    expect(req.headers['x-api-key']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty-string apiKey (defensive — would otherwise short-circuit the guard with junk)', () => {
    const req: any = { headers: {}, body: { apiKey: '' } };
    run(req);
    expect(req.headers['x-api-key']).toBeUndefined();
  });

  it('ignores a non-string apiKey to avoid header-injection from malformed clients', () => {
    const req: any = { headers: {}, body: { apiKey: { nested: 'object' } } };
    run(req);
    expect(req.headers['x-api-key']).toBeUndefined();
  });
});
