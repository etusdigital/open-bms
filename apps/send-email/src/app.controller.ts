import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';
import { SendEmailMessage, PubSubMessage, CompressedAutomationPayload } from './interfaces';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getState(): Promise<ResultDto> {
    return this.appService.getState();
  }

  @Post()
  async receiveMessage(@Body() data: SendEmailMessage | PubSubMessage | CompressedAutomationPayload): Promise<ResultDto> {
    try {
      if ('subscription' in (data as PubSubMessage)) {
        data = this.appService.parseNewMessageDtoToSendMailMessage(data as PubSubMessage);
      }
      const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as SendEmailMessage;
      }
      const sendEmailMessage = data as SendEmailMessage;

      return await this.appService.receiveMessage(sendEmailMessage, redisKeyPayload);
    } catch (error) {
      const errorMessage = error.message || error;
      if (errorMessage && errorMessage.includes('Invalid URL')) {
        if ('subscription' in (data as PubSubMessage)) {
          data = this.appService.parseNewMessageDtoToSendMailMessage(data as PubSubMessage);
        }
        const sendEmailMessage = data as SendEmailMessage;
        console.log(`Error URL: ${errorMessage}`, JSON.stringify(data));
        await this.appService.sendToNextStep(sendEmailMessage.next.data, {});
        return;
      }
      console.log(`Error: ${errorMessage}`, JSON.stringify(data));
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
