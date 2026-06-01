import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PublicRoute } from '../authz/public-route.decorator';
import { AccountsService } from './accounts.service';
import { buildTracker, buildWebPush } from '../../lib/web-push-sw';
// getWebPushPlatformConfig lives on AccountsService (reads system_config.fcm_settings).

// Serves the per-account web-push service worker from the BMS domain itself —
// no public S3/CDN bucket required. The customer hosts a tiny same-origin sw.js
// that importScripts() this URL (importScripts is cross-origin-capable; SW
// registration stays same-origin on the customer side).
//
// Public on purpose: the file contains only client-side public values (Firebase
// web config, VAPID public key, tracker URL) — no secrets.
@Controller('bms')
export class WebPushPublicController {
  constructor(private readonly accountsService: AccountsService) {}

  @PublicRoute()
  @Get('push/:accountHash.js')
  async serveServiceWorker(@Param('accountHash') accountHash: string, @Res() res: Response): Promise<void> {
    const accountId = await this.accountsService.resolveAccountIdByHash(accountHash);
    if (!accountId) throw new NotFoundException('Service worker not found');
    const js = await this.accountsService.renderAccountServiceWorker(accountId);
    this.sendJs(res, js, 'no-store');
  }

  // bmstrk.js — the on-page tracker, served from THIS instance with its
  // endpoints pointed at us (not in.bri.us). The snippet loads it; it then loads
  // web-push.js from us too. Short cache is fine (same for all accounts).
  @PublicRoute()
  @Get('bmstrk.js')
  serveTracker(@Res() res: Response): void {
    const base = (process.env.BMS_PUBLIC_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    this.sendJs(res, buildTracker(base), 'public, max-age=300');
  }

  // web-push.js — the on-page FCM client (vendored Firebase SDK + bmsPush). Same
  // for all accounts. The PLATFORM Firebase config + VAPID (single-project) are
  // substituted into the bundle here, server-side — never exposed in the page
  // snippet (parity with Enterprise, and required because the constructor calls
  // initializeApp() before any snippet override could apply). Public client code.
  @PublicRoute()
  @Get('web-push.js')
  async serveWebPush(@Res() res: Response): Promise<void> {
    const base = (process.env.BMS_PUBLIC_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const platform = await this.accountsService.getWebPushPlatformConfig();
    this.sendJs(res, buildWebPush(base, platform ?? undefined), 'public, max-age=300');
  }

  private sendJs(res: Response, js: string, cacheControl: string): void {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(js);
  }
}
