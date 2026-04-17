import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';
import {
  CampaignMessage,
  CompressedAutomationPayload,
  CompressedCampaignPayload,
  PubSubMessage,
  SendPushMessage,
} from './interfaces';
import { Utils } from './utils/index.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly utils: Utils
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  async processRequest(@Body() data: CampaignMessage | PubSubMessage | CompressedCampaignPayload): Promise<any> {
    if ('subscription' in (data as PubSubMessage)) {
      data = this.utils.parsePubSubMessage(data as PubSubMessage);
    }

    const redisKeyPayload = `${(data as CompressedCampaignPayload).campaignKey || ''}`;
    if (redisKeyPayload) {
      data = (await this.appService.getDelRedis(redisKeyPayload)) as CampaignMessage;

      if (!data) {
        console.error('Body payload is null, redisKeyPayload: ', redisKeyPayload);
        return;
      }
    }

    process.on('uncaughtException', async (_error) => {
      console.error('[SHUTDOWN APP CONTROLLER] - uncaughtException: ', JSON.stringify(data));
      if (redisKeyPayload) {
        console.log(`SET REDIS SHUTDOWN - ${redisKeyPayload} - PAYLOAD: ${JSON.stringify(data)}`, redisKeyPayload);
        await this.appService.setRedis(redisKeyPayload, data, 43200);
      }
    });

    try {
      return await this.appService.process(data as CampaignMessage, redisKeyPayload);
    } catch (error) {
      if (redisKeyPayload) {
        console.log(`ERROR KEY - ${redisKeyPayload} - PAYLOAD: ${JSON.stringify(data)}`, redisKeyPayload);
        await this.appService.setRedis(redisKeyPayload, data, 43200);
      }
      console.log('error', error);
      throw error;
    }
  }

  @Post('/single')
  async receiveMessage(@Body() data: SendPushMessage | PubSubMessage | CompressedAutomationPayload): Promise<any> {
    if ('subscription' in (data as PubSubMessage)) {
      data = this.utils.parsePubSubMessage(data as PubSubMessage);
    }

    const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
    if (redisKeyPayload) {
      data = (await this.appService.getDelRedis(redisKeyPayload)) as SendPushMessage;

      if (!data) {
        console.error('Body payload is null, redisKeyPayload:', redisKeyPayload);
        return;
      }
    }
    // process.on('uncaughtException', (error) => {
    //   console.error('[SHUTDOWN APP CONTROLLER] - uncaughtException: ', JSON.stringify(data));
    // });

    try {
      return await this.appService.processSingle(data as SendPushMessage, redisKeyPayload);
    } catch (error) {
      console.log('error', error);
      console.log('sendPushMessage', JSON.stringify(data));

      const errorMessage = error.message || error;
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
