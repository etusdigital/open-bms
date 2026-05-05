import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { Campaign, CampaignBatch } from './interfaces';
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
  async createBatches(@Body() campaign: Campaign) {
    this.formatterUtils.logInfo(`[Create Batches] Campaign: ${JSON.stringify(campaign)}`);
    return await this.campaignService.createBatches(campaign);
  }

  @Post('/process-page')
  async processPage(@Body() data: CampaignBatch) {
    this.formatterUtils.logInfo(`[Process Page] Campaign: ${JSON.stringify(data)}`);
    return await this.campaignService.processPage(data);
  }

  @Post('/create-test/:id')
  async createTest(@Param('id') id: number) {
    return await this.campaignService.createTest(id);
  }

  @Post('/result-test/:id')
  async resultTest(@Param('id') id: number) {
    return await this.campaignService.processResult(id);
  }
}
