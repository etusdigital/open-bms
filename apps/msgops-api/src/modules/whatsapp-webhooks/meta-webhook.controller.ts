import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, HttpStatus, Logger, Post, Query, Req, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { verifyMetaSignature } from '@bms/whatsapp-cloud';
import { PublicRoute } from '../authz/public-route.decorator';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Wave 4 — Meta WhatsApp webhook receiver (direct mode).
 *
 * Both methods are PublicRoute: the verify token (GET) and the signature
 * (POST) provide the authn. Following AC3 of the spec, requests with bad
 * signatures return 401 / 403 and are not enqueued.
 */
@Controller('webhooks/meta')
@ApiTags('WhatsApp Webhooks')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(private readonly webhooks: WhatsappWebhooksService) {}

  /**
   * Meta webhook handshake. Returns the `hub.challenge` plaintext when the
   * verify token matches WHATSAPP_VERIFY_TOKEN.
   */
  @Get()
  @PublicRoute()
  @ApiOperation({ summary: 'Meta webhook verification (GET challenge)' })
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string): string {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!expected) throw new ServiceUnavailableException('WHATSAPP_VERIFY_TOKEN not configured');
    if (mode !== 'subscribe' || token !== expected) {
      throw new ForbiddenException('Invalid verify token');
    }
    return challenge ?? '';
  }

  @Post()
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta webhook delivery (POST event)' })
  async receive(@Req() req: RequestWithRawBody, @Headers('x-hub-signature-256') signature: string | undefined, @Body() body: any): Promise<{ ok: true; skipped?: 'duplicate' }> {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) throw new ServiceUnavailableException('WHATSAPP_APP_SECRET not configured');

    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    if (!verifyMetaSignature(raw, signature ?? null, secret)) {
      // 401 instead of 403 here — Meta retries on 5xx, ignores on 4xx, so
      // returning 401 lets us avoid resend storms when a deploy mis-rotates
      // the secret. Logged so ops can spot it.
      this.logger.warn('meta_webhook_invalid_signature');
      throw new ForbiddenException('Invalid X-Hub-Signature-256');
    }

    const deliveryKey = this.webhooks.buildMetaDeliveryKey(raw);
    if (await this.webhooks.isDuplicate('meta', deliveryKey)) {
      this.logger.log(`meta_webhook_skipped_duplicate key=${deliveryKey.slice(0, 12)}`);
      return { ok: true, skipped: 'duplicate' };
    }

    await this.webhooks.processMetaEvent(body);
    return { ok: true };
  }
}
