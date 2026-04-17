import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import {
  CampaignMessage,
  PubSubMessage,
  AutomationMessage,
  SingleMessage,
  CompressedAutomationPayload,
  CompressedCampaignPayload,
} from './interfaces';
import { Utils } from './utils/index.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly utils: Utils,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/single')
  async processSingleSms(@Body() data: SingleMessage | PubSubMessage | CompressedAutomationPayload): Promise<any> {
    try {
      const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as SingleMessage;
      }
      const twoFactorMessage =
        'subscription' in (data as PubSubMessage)
          ? this.utils.parsePubSubMessage(data as PubSubMessage)
          : (data as SingleMessage);

      return await this.appService.processSingleSms(twoFactorMessage, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/campaign')
  async processCampaign(@Body() data: CampaignMessage | PubSubMessage | CompressedCampaignPayload): Promise<any> {
    try {
      if ('subscription' in (data as PubSubMessage)) {
        data = this.utils.parsePubSubMessage(data as PubSubMessage);
      }
      const redisKeyPayload = `${(data as CompressedCampaignPayload).campaignKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as CampaignMessage;
      }
      const campaignMessage = data as CampaignMessage;

      return await this.appService.processCampaign(campaignMessage, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/automation')
  async processAutomation(@Body() data: AutomationMessage | PubSubMessage | CompressedAutomationPayload): Promise<any> {
    try {
      if ('subscription' in (data as PubSubMessage)) {
        data = this.utils.parsePubSubMessage(data as PubSubMessage);
      }
      const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as AutomationMessage;
      }
      const automationMessage = data as AutomationMessage;

      return await this.appService.processAutomation(automationMessage, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
