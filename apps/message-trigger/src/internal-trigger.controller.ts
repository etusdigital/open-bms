import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { AppService } from './app.service';
import { ResultDto } from './dtos/result.dto';
import { CompressedPayload, LeadStateMessage } from './interfaces';

@Controller('internal/trigger')
export class InternalTriggerController {
  constructor(private readonly appService: AppService) {}

  private assertAuth(token: string): void {
    const expected = process.env.INTERNAL_AUTH_TOKEN;
    if (!expected || !token) {
      throw new UnauthorizedException();
    }
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }
  }

  @Post('process')
  async process(@Headers('x-internal-token') token: string, @Body() data: LeadStateMessage | CompressedPayload): Promise<ResultDto> {
    this.assertAuth(token);
    let leadStateMessage: LeadStateMessage;
    const redisKeyPayload = (data as CompressedPayload).automationKey || '';
    if (redisKeyPayload) {
      leadStateMessage = (await this.appService.getRedis(redisKeyPayload)) as LeadStateMessage;
    } else {
      leadStateMessage = data as LeadStateMessage;
    }

    return this.appService.receiveMessage(leadStateMessage, 'amqp', redisKeyPayload);
  }
}
