import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Logger, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { verifyHubSignature } from '@bms/evolution-hub';
import { PublicRoute } from '../authz/public-route.decorator';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Wave 4 — EvoHub webhook receiver (turnkey mode).
 *
 * Signed with EVOLUTION_HUB_WEBHOOK_SECRET (HMAC-SHA256). Uses the
 * X-Hub-Delivery-Id header for dedup if present, falling back to a hash of
 * the body — same strategy as the Meta controller, which keeps AC4 uniform.
 */
@Controller('webhooks/evolution-hub')
@ApiTags('WhatsApp Webhooks')
export class EvolutionHubWebhookController {
  private readonly logger = new Logger(EvolutionHubWebhookController.name);

  constructor(private readonly webhooks: WhatsappWebhooksService) {}

  @Post()
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'EvoHub webhook delivery' })
  async receive(
    @Req() req: RequestWithRawBody,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-hub-delivery-id') deliveryId: string | undefined,
    @Body() body: any,
  ): Promise<{ ok: true; skipped?: 'duplicate' }> {
    const secret = process.env.EVOLUTION_HUB_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('EVOLUTION_HUB_WEBHOOK_SECRET not configured');

    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    if (!verifyHubSignature(raw, signature ?? null, secret)) {
      this.logger.warn('evohub_webhook_invalid_signature');
      throw new ForbiddenException('Invalid HMAC signature');
    }

    const deliveryKey = deliveryId ?? this.webhooks.buildMetaDeliveryKey(raw);
    if (await this.webhooks.isDuplicate('evohub', deliveryKey)) {
      this.logger.log(`evohub_webhook_skipped_duplicate key=${deliveryKey.slice(0, 24)}`);
      return { ok: true, skipped: 'duplicate' };
    }

    await this.webhooks.processHubEvent(body);
    return { ok: true };
  }
}
