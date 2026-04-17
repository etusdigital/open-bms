import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { Campaign, CampaignBatch, PageMessage, SubscriptionMessage, Warmup } from './interfaces';
import { CampaignService } from './campaign/campaign.service';
import { FormatterUtils } from './utils/formatter.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly campaignService: CampaignService,
    private readonly formatterUtils: FormatterUtils,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/create-contacts-send/:id')
  async postCampaign(@Param('id') id: number) {
    return this.campaignService.createContactsSend(id);
  }

  @Post('/create-batches')
  async createBatches(@Body() data: Campaign | SubscriptionMessage) {
    const campaign = 'subscription' in (data as SubscriptionMessage) ? this.formatterUtils.parseBatch(data as SubscriptionMessage) : (data as Campaign);

    this.formatterUtils.logInfo(`[Create Batches] Campaign: ${JSON.stringify(campaign)}`);

    return await this.campaignService.createBatches(campaign);
  }

  @Post('/schedule-pages')
  async schedulePages(@Body() data: PageMessage | SubscriptionMessage) {
    const pageToSchedule = 'subscription' in (data as SubscriptionMessage) ? this.formatterUtils.parseBatch(data as SubscriptionMessage) : (data as PageMessage);

    return await this.campaignService.schedulePage(pageToSchedule);
  }

  @Post('/process-page')
  async processPage(@Body() data: CampaignBatch | SubscriptionMessage) {
    const campaign = 'subscription' in (data as SubscriptionMessage) ? this.formatterUtils.parseBatch(data as SubscriptionMessage) : (data as CampaignBatch);

    this.formatterUtils.logInfo(`[Process Page] Campaign: ${JSON.stringify(campaign)}`);

    return await this.campaignService.processPage(campaign);
  }

  @Post('/create-test/:id')
  async createTest(@Param('id') id: number) {
    return await this.campaignService.createTest(id);
  }

  @Post('/result-test/:id')
  async resultTest(@Param('id') id: number) {
    return await this.campaignService.processResult(id);
  }

  @Post('/warmup-start')
  async warmupStart(@Body() data: Warmup | SubscriptionMessage) {
    const warmup = 'subscription' in (data as SubscriptionMessage) ? this.formatterUtils.parseBatch(data as SubscriptionMessage) : (data as Warmup);
    return await this.campaignService.warmupStart(warmup.campaign, warmup.warmups);
  }
}
