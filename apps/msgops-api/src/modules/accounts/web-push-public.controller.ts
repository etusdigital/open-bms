import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PublicRoute } from '../authz/public-route.decorator';
import { AccountsService } from './accounts.service';

// Serves the per-account web-push service worker from the BMS domain itself —
// no public S3/CDN bucket required. The customer hosts a tiny same-origin sw.js
// that importScripts() this URL (importScripts is cross-origin-capable; SW
// registration stays same-origin on the customer side).
//
// Public on purpose: the file contains only client-side public values (Firebase
// web config, VAPID public key, tracker URL) — no secrets.
@Controller('bms/push')
export class WebPushPublicController {
  constructor(private readonly accountsService: AccountsService) {}

  @PublicRoute()
  @Get(':accountHash.js')
  async serveServiceWorker(@Param('accountHash') accountHash: string, @Res() res: Response): Promise<void> {
    const accountId = await this.accountsService.resolveAccountIdByHash(accountHash);
    if (!accountId) throw new NotFoundException('Service worker not found');
    const js = await this.accountsService.renderAccountServiceWorker(accountId);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    // Service worker must not be cached stale; the browser revalidates on update.
    res.setHeader('Cache-Control', 'no-store');
    // Allow the customer site to importScripts this cross-origin file.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(js);
  }
}
