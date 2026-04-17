import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { NotifyPayload } from './interfaces';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/notify')
  async notify(@Body() data: NotifyPayload): Promise<any> {
    return this.appService.notify(data);
  }
}
