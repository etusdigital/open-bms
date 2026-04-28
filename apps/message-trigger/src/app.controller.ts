import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';
import { CompressedPayload, LeadStateMessage } from './interfaces';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getState(): Promise<ResultDto> {
    return this.appService.getState();
  }

  @Post('http-request')
  async processHttpRequest(@Body() data: LeadStateMessage) {
    try {
      return await this.appService.processHttpRequest(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post()
  async receiveMessage(@Body() data: LeadStateMessage | CompressedPayload): Promise<ResultDto> {
    try {
      let leadStateMessage: LeadStateMessage;
      const redisKeyPayload = (data as CompressedPayload).automationKey || '';
      if (redisKeyPayload) {
        leadStateMessage = (await this.appService.getRedis(redisKeyPayload)) as LeadStateMessage;
      } else {
        leadStateMessage = data as LeadStateMessage;
      }

      return await this.appService.receiveMessage(leadStateMessage, 'http', redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
