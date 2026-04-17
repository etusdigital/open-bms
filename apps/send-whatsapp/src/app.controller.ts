import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { CampaignMessage, PubSubMessage, AutomationMessage } from './interfaces';
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

  @Post('/campaign')
  async processCampaign(@Body() data: CampaignMessage | PubSubMessage): Promise<any> {
    try {
      const campaignMessage = 'subscription' in (data as PubSubMessage) ? this.utils.parsePubSubMessage(data as PubSubMessage) : (data as CampaignMessage);

      return await this.appService.processCampaign(campaignMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/automation')
  async processAutomation(@Body() data: AutomationMessage | PubSubMessage): Promise<any> {
    try {
      const automationMessage = 'subscription' in (data as PubSubMessage) ? this.utils.parsePubSubMessage(data as PubSubMessage) : (data as AutomationMessage);

      return await this.appService.processAutomation(automationMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
