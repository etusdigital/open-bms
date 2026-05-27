import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { AppService } from './app.service';
import {
  CampaignMessage,
  AutomationMessage,
  SingleMessage,
  CompressedAutomationPayload,
  CompressedCampaignPayload,
} from './interfaces';

function isAuthorized(received: string | undefined, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // TODO(EVO-952 Onda 5): bind queue para single quando msgops-api migrar para
  // AMQP — ver docs/migration/evo-952-wave-2-decisions.md §1/§5. Hoje sem fonte AMQP.
  @Post('/single')
  async processSingleSms(@Body() data: SingleMessage | CompressedAutomationPayload): Promise<any> {
    try {
      const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as SingleMessage;
      }
      return await this.appService.processSingleSms(data as SingleMessage, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  // TODO(EVO-952 Onda 4): bind queue para campaign batch quando campaign-packer
  // migrar para AMQP — ver docs/migration/evo-952-wave-2-decisions.md §1/§5. Hoje sem fonte AMQP.
  @Post('/campaign')
  async processCampaign(@Body() data: CampaignMessage | CompressedCampaignPayload): Promise<any> {
    try {
      const redisKeyPayload = `${(data as CompressedCampaignPayload).campaignKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as CampaignMessage;
      }
      return await this.appService.processCampaign(data as CampaignMessage, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/internal/sms/automation')
  async processAutomation(
    @Headers('x-internal-token') token: string,
    @Body() data: AutomationMessage | CompressedAutomationPayload,
  ): Promise<any> {
    if (!isAuthorized(token, process.env.INTERNAL_AUTH_TOKEN)) {
      throw new UnauthorizedException();
    }
    try {
      const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as AutomationMessage;
      }
      return await this.appService.processAutomation(data as AutomationMessage, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
