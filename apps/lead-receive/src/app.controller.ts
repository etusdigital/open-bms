import { Body, Controller, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { LeadMessage, QuizMakerPayload } from './app.interfaces';
import { IpAddress } from './decorators/ip-address.decorator';
import { Request, Response } from 'express';
import { Utils } from './utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly utils: Utils,
  ) {}

  @Post(['/contacts', '/bms/leads/update'])
  async updateContact(
    @Body() leadMessage: LeadMessage,
    @Req() request: Request,
    @IpAddress() ipAddress?: string,
  ): Promise<any> {
    try {
      let updatedMessage = { ...leadMessage };

      if (request.readable) {
        // body is ignored by NestJS -> get raw body from request
        const rawBody = await this.utils.getRawBody(request as unknown as NodeJS.ReadableStream);
        if (rawBody) {
          updatedMessage = rawBody as LeadMessage;
        }
      }

      if (!updatedMessage.contact.ip) {
        updatedMessage.contact.ip = ipAddress;
      }

      if (!updatedMessage.user_agent) {
        updatedMessage.user_agent = request.headers['user-agent'];
      }

      this.utils.logInfo('update contact payload', updatedMessage);

      return this.appService.updateContact(updatedMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('*')
  async process(
    @Body() leadMessage: LeadMessage | QuizMakerPayload,
    @Req() request: Request,
    @Res() response: Response,
    @IpAddress() ipAddress?: string,
  ): Promise<any> {
    try {
      let updatedMessage = { ...leadMessage };

      if (request.readable) {
        // body is ignored by NestJS -> get raw body from request
        const rawBody = await this.utils.getRawBody(request as unknown as NodeJS.ReadableStream);
        if (rawBody) {
          updatedMessage = rawBody;
        }
      }

      this.utils.logInfo('leadMessage: ', updatedMessage);

      if (updatedMessage.app && (!updatedMessage.contact || !updatedMessage.apiKey || !updatedMessage.tagName)) {
        updatedMessage = await this.appService.parsePayloadQuiz(updatedMessage as QuizMakerPayload, request.headers);
      }

      if (!updatedMessage.contact || Object.keys(updatedMessage.contact).length === 0) {
        console.error('Empty contact', JSON.stringify(updatedMessage));
        return response.status(HttpStatus.BAD_REQUEST).json({
          status: HttpStatus.BAD_REQUEST,
          message: 'Empty contact',
        });
      }

      if (!updatedMessage.apiKey) {
        console.error('No APikey', JSON.stringify(updatedMessage));
        return response.status(HttpStatus.BAD_REQUEST).json({
          status: HttpStatus.BAD_REQUEST,
          message: 'No API key',
        });
      }

      if (updatedMessage.contact && updatedMessage.contact.email && !updatedMessage.contact.email.includes('@')) {
        console.error(`Invalid Payload Email: ${JSON.stringify(updatedMessage)}`);
        return response.status(HttpStatus.BAD_REQUEST).json({
          status: HttpStatus.BAD_REQUEST,
          message: `Invalid Payload Email: ${updatedMessage.contact.email}`,
        });
      }

      if (
        (updatedMessage.contact.firstName && updatedMessage.contact.firstName.length > 100) ||
        (updatedMessage.contact.name && updatedMessage.contact.name.length > 100)
      ) {
        console.error(`Invalid Payload First Name is too long: ${JSON.stringify(updatedMessage)}`);
        return response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: `Invalid Payload First Name is too long: ${updatedMessage.contact.firstName || updatedMessage.contact.name}`,
        });
      }

      if (!updatedMessage.contact.ip) {
        updatedMessage.contact.ip = ipAddress;
      }

      if (!updatedMessage.user_agent) {
        updatedMessage.user_agent = request.headers['user-agent'];
      }

      if (updatedMessage.contact.devices && updatedMessage.contact.devices.length) {
        for (const device of updatedMessage.contact.devices) {
          device.ip = device.ip ? device.ip : ipAddress;
        }
      }

      const result = await this.appService.process(updatedMessage as LeadMessage);
      response.status(HttpStatus.OK).json(result);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
