import { Controller, Get, Logger, Param, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { Campaign, CampaignBatch } from './interfaces';
import { CampaignService } from './campaign/campaign.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly campaignService: CampaignService,
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
    this.logger.log(`[Create Batches] Campaign: ${JSON.stringify(campaign)}`);
    return await this.campaignService.createBatches(campaign);
  }

  @Post('/process-page')
  async processPage(@Body() data: CampaignBatch) {
    this.logger.log(`[Process Page] Campaign: ${JSON.stringify(data)}`);
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
