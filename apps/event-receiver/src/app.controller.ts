import { Controller, Post, Req, Headers } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post(['/*'])
  async handleEvent(@Req() request: FastifyRequest, @Headers() headers: any) {
    await this.appService.handleMessage(request, headers);
    return { response: 'ok' };
  }
}
