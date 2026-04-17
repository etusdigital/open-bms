import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { NewMessageDto } from './dtos/message.dto';
import { ResultDto } from './dtos/result.dto';
import { FormatterUtils } from './utils/formatter.utils';
import { CompressedPayload, LeadStateMessage } from './interfaces';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly formatterUtils: FormatterUtils,
  ) {}

  @Get()
  getState(): Promise<ResultDto> {
    return this.appService.getState();
  }

  @Post('http-request')
  async processHttpRequest(@Body() data: LeadStateMessage | NewMessageDto) {
    try {
      const leadStateMessage = 'subscription' in (data as NewMessageDto) ? this.formatterUtils.parseBase64ToObject(data as NewMessageDto) : (data as LeadStateMessage);
      return await this.appService.processHttpRequest(leadStateMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post()
  async receiveMessage(@Body() data: LeadStateMessage | NewMessageDto | CompressedPayload): Promise<ResultDto> {
    try {
      let messageId: string;
      if ('subscription' in (data as NewMessageDto)) {
        data = this.formatterUtils.parseBase64ToObject(data as NewMessageDto);
      }
      const redisKeyPayload = `${(data as CompressedPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as LeadStateMessage;
      }
      if ((data as NewMessageDto).message && (data as NewMessageDto).message.messageId) {
        //TODO: this code is unreachable
        messageId = (data as NewMessageDto).message.messageId;
      } else {
        messageId = 'local';
      }

      const leadStateMessage = data as LeadStateMessage;

      return await this.appService.receiveMessage(leadStateMessage, messageId, redisKeyPayload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
