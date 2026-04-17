import { Controller, Get, Headers, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(['/validate', '/bms/validations'])
  async validate(@Query('email') email: string, @Headers('api-key') apiKey: string): Promise<any> {
    return await this.appService.validate(email, apiKey, true);
  }

  // TODO: Remove common path after finish migration
  @Get('/api/validations/email')
  async oldCommon(@Query('email') email: string): Promise<any> {
    return await this.appService.validate(email, '', false);
  }
}
