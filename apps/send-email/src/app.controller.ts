import { Body, Controller, Get, Headers, HttpException, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';
import { SendEmailMessage, CompressedAutomationPayload } from './interfaces';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getState(): Promise<ResultDto> {
    return this.appService.getState();
  }

  @Post('/internal/email/send')
  async receiveMessage(@Headers('x-internal-token') token: string, @Body() data: SendEmailMessage | CompressedAutomationPayload): Promise<ResultDto> {
    if (token !== process.env.INTERNAL_AUTH_TOKEN) {
      throw new UnauthorizedException();
    }
    try {
      const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
      if (redisKeyPayload) {
        data = (await this.appService.getRedis(redisKeyPayload)) as SendEmailMessage;
      }
      const sendEmailMessage = data as SendEmailMessage;

      return await this.appService.receiveMessage(sendEmailMessage, redisKeyPayload);
    } catch (error) {
      const errorMessage = error.message || error;
      if (errorMessage && errorMessage.includes('Invalid URL')) {
        const sendEmailMessage = data as SendEmailMessage;
        console.log(`Error URL: ${errorMessage}`, JSON.stringify(data));
        await this.appService.sendToNextStep(sendEmailMessage.next.data, '');
        return;
      }
      console.log(`Error: ${errorMessage}`, JSON.stringify(data));
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
