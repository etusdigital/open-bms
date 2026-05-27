import { Body, Controller, Get, Headers, HttpException, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { AppService } from './app.service';
import { CampaignMessage, CompressedAutomationPayload, CompressedCampaignPayload, SendPushMessage } from './interfaces';

function isAuthorized(received: string | undefined, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // TODO(EVO-952 Onda 4): bind queue para campaign batch quando campaign-packer
  // migrar para AMQP — ver docs/migration/evo-952-wave-2-decisions.md §1/§5. Hoje sem fonte AMQP.
  @Post()
  async processRequest(@Body() data: CampaignMessage | CompressedCampaignPayload): Promise<any> {
    const redisKeyPayload = `${(data as CompressedCampaignPayload).campaignKey || ''}`;
    if (redisKeyPayload) {
      data = (await this.appService.getDelRedis(redisKeyPayload)) as CampaignMessage;

      if (!data) {
        console.error('Body payload is null, redisKeyPayload: ', redisKeyPayload);
        return;
      }
    }

    process.on('uncaughtException', async (_error) => {
      console.error('[SHUTDOWN APP CONTROLLER] - uncaughtException: ', JSON.stringify(data));
      if (redisKeyPayload) {
        console.log(`SET REDIS SHUTDOWN - ${redisKeyPayload} - PAYLOAD: ${JSON.stringify(data)}`, redisKeyPayload);
        await this.appService.setRedis(redisKeyPayload, data, 43200);
      }
    });

    try {
      return await this.appService.process(data as CampaignMessage, redisKeyPayload);
    } catch (error) {
      if (redisKeyPayload) {
        console.log(`ERROR KEY - ${redisKeyPayload} - PAYLOAD: ${JSON.stringify(data)}`, redisKeyPayload);
        await this.appService.setRedis(redisKeyPayload, data, 43200);
      }
      console.log('error', error);
      throw error;
    }
  }

  @Post('/internal/push/single')
  async receiveMessage(
    @Headers('x-internal-token') token: string,
    @Body() data: SendPushMessage | CompressedAutomationPayload
  ): Promise<any> {
    if (!isAuthorized(token, process.env.INTERNAL_AUTH_TOKEN)) {
      throw new UnauthorizedException();
    }
    const redisKeyPayload = `${(data as CompressedAutomationPayload).automationKey || ''}`;
    if (redisKeyPayload) {
      data = (await this.appService.getDelRedis(redisKeyPayload)) as SendPushMessage;

      if (!data) {
        console.error('Body payload is null, redisKeyPayload:', redisKeyPayload);
        return;
      }
    }

    try {
      return await this.appService.processSingle(data as SendPushMessage, redisKeyPayload);
    } catch (error) {
      console.log('error', error);
      console.log('sendPushMessage', JSON.stringify(data));

      const errorMessage = error.message || error;
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
