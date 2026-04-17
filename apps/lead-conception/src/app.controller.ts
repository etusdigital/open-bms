import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { LeadMessage, PubSubMessage } from './interfaces';
import { FormatterUtils } from './utils/formatter.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly formatterUtils: FormatterUtils,
  ) {}

  @Post('update-contact')
  async updateContact(@Body() data: LeadMessage | PubSubMessage): Promise<any> {
    const leadMessage = 'subscription' in data ? this.formatterUtils.parsePubSubMessage(data as PubSubMessage) : (data as LeadMessage);

    const result = await this.appService.createOrUpdate(leadMessage, true);
    if (result && result.status !== HttpStatus.OK) {
      throw new HttpException(result.message, result.status);
    }

    return result;
  }

  @Post('/')
  async createOrUpdate(@Body() data: LeadMessage | PubSubMessage): Promise<any> {
    const leadMessage = 'subscription' in data ? this.formatterUtils.parsePubSubMessage(data as PubSubMessage) : (data as LeadMessage);

    const result = await this.appService.createOrUpdate(leadMessage);

    if (result && result.status !== HttpStatus.OK) {
      throw new HttpException(result.message, result.status);
    }

    return result;
  }
}
