import { Body, Controller, Get, Headers, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type Redis from 'ioredis';
import { AppService } from './app.service';
import { CampaignMessage, AutomationMessage } from './interfaces';
import { REDIS } from './providers/redis/redis.provider';

function isAuthorized(received: string | undefined, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Legacy HTTP entrypoint (kept for direct test/internal callers). The
  // production source is now the AMQP binding bms.campaigns/campaign.send
  // handled by `/internal/campaigns/send` below.
  @Post('/campaign')
  async processCampaign(@Body() data: CampaignMessage): Promise<any> {
    try {
      return await this.appService.processCampaign(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Campaign batch endpoint reached by the AMQP→HTTP bridge inside
   * `SendWhatsappConsumerService`. The packer publishes a tiny envelope
   * `{ campaignKey, campaign, page, ... }` on `bms.campaigns/campaign.send`
   * and stores the full batch payload under `redis[campaignKey]` (TTL 12h).
   * Fetch it back, parse, and delegate to the same processCampaign service.
   */
  @Post('/internal/campaigns/send')
  async processCampaignBatch(@Headers('x-internal-token') token: string, @Body() body: { campaignKey?: string }): Promise<any> {
    if (!isAuthorized(token, process.env.INTERNAL_AUTH_TOKEN)) {
      throw new UnauthorizedException();
    }
    if (!body?.campaignKey) {
      return { status: 400, message: 'missing campaignKey' };
    }
    const raw = await this.redis.get(body.campaignKey);
    if (!raw) {
      console.error(`[campaigns] redis key ${body.campaignKey} not found (expired or wrong key)`);
      return { status: 410, message: 'campaign payload expired' };
    }
    let batch: CampaignMessage;
    try {
      batch = JSON.parse(raw);
    } catch (e) {
      console.error(`[campaigns] failed to parse redis payload for key ${body.campaignKey}:`, e);
      return { status: 500, message: 'invalid campaign payload' };
    }
    try {
      return await this.appService.processCampaign(batch);
    } catch (e) {
      console.error(`[campaigns] processCampaign failed for key ${body.campaignKey}:`, e);
      throw e;
    }
  }

  @Post('/internal/whatsapp/automation')
  async processAutomation(@Headers('x-internal-token') token: string, @Body() data: AutomationMessage): Promise<any> {
    if (!isAuthorized(token, process.env.INTERNAL_AUTH_TOKEN)) {
      throw new UnauthorizedException();
    }
    try {
      return await this.appService.processAutomation(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
