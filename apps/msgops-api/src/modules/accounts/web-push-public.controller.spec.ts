import { NotFoundException } from '@nestjs/common';
import { WebPushPublicController } from './web-push-public.controller';
import type { AccountsService } from './accounts.service';

// The public web-push assets are served from BMS itself (no S3/CDN). These tests
// cover the three routes' HTTP wiring: correct headers, cache policy, 404 on an
// unknown account hash, and that web-push.js / bmstrk.js are rewritten to THIS
// instance (BMS_PUBLIC_URL) — not the bri.us defaults.

function buildController(svc: Partial<AccountsService> = {}) {
  const accountsService = {
    resolveAccountIdByHash: jest.fn(),
    renderAccountServiceWorker: jest.fn(),
    ...svc,
  } as unknown as AccountsService;
  const controller = new WebPushPublicController(accountsService);
  return { controller, accountsService };
}

function mockRes() {
  return { setHeader: jest.fn(), send: jest.fn() } as any;
}

describe('WebPushPublicController', () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    process.env.BMS_PUBLIC_URL = 'https://bms.example.com';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  describe('serveServiceWorker (GET /bms/push/:accountHash.js)', () => {
    it('renders the account SW with no-store cache + JS content-type', async () => {
      const { controller, accountsService } = buildController({
        resolveAccountIdByHash: jest.fn().mockResolvedValue(7),
        renderAccountServiceWorker: jest.fn().mockResolvedValue('self.__sw__ = 1;'),
      });
      const res = mockRes();

      await controller.serveServiceWorker('abc123', res);

      expect(accountsService.resolveAccountIdByHash).toHaveBeenCalledWith('abc123');
      expect(accountsService.renderAccountServiceWorker).toHaveBeenCalledWith(7);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/javascript; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.send).toHaveBeenCalledWith('self.__sw__ = 1;');
    });

    it('throws 404 when the account hash does not resolve', async () => {
      const { controller, accountsService } = buildController({
        resolveAccountIdByHash: jest.fn().mockResolvedValue(null),
      });
      const res = mockRes();

      await expect(controller.serveServiceWorker('deadbeef', res)).rejects.toBeInstanceOf(NotFoundException);
      expect(accountsService.renderAccountServiceWorker).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  describe('serveTracker (GET /bms/bmstrk.js)', () => {
    it('serves the tracker pointed at this instance, cacheable', () => {
      const { controller } = buildController();
      const res = mockRes();

      controller.serveTracker(res);

      const sent = res.send.mock.calls[0][0] as string;
      expect(typeof sent).toBe('string');
      expect(sent.length).toBeGreaterThan(0);
      // Rewritten to us; the web-push loader points at our route.
      expect(sent).toContain('https://bms.example.com/bms/web-push.js');
      expect(sent).not.toContain('__BMS_');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    });
  });

  describe('serveWebPush (GET /bms/web-push.js)', () => {
    it('serves the vendored FCM client with endpoints rewritten to this instance', () => {
      const { controller } = buildController();
      const res = mockRes();

      controller.serveWebPush(res);

      const sent = res.send.mock.calls[0][0] as string;
      // Vendored Firebase SDK + bmsPush class must be intact...
      expect(sent).toContain('class bmsPush');
      expect(sent).toContain('initializeApp');
      // ...and every endpoint rewritten to us, no placeholders / bri.us residue.
      expect(sent).toContain('https://bms.example.com/bms/leads/web-push');
      expect(sent).not.toContain('__BMS_');
      expect(sent).not.toContain('in.bri.us');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/javascript; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    });
  });
});
