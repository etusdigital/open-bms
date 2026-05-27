import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AppService } from './app.service';
import { EventsTarget, EventsTrigger, LeadMessage } from './interfaces';

@Controller('internal/automation')
export class InternalAutomationController {
  constructor(private readonly appService: AppService) {}

  private assertAuth(token: string): void {
    if (!process.env.INTERNAL_AUTH_TOKEN || token !== process.env.INTERNAL_AUTH_TOKEN) {
      throw new UnauthorizedException();
    }
  }

  @Post('add')
  async add(@Headers('x-internal-token') token: string, @Body() data: LeadMessage): Promise<any> {
    this.assertAuth(token);
    return this.appService.addTag(data);
  }

  @Post('remove')
  async remove(@Headers('x-internal-token') token: string, @Body() data: LeadMessage): Promise<any> {
    this.assertAuth(token);
    return this.appService.removeTag(data);
  }

  @Post('cancel')
  async cancel(@Headers('x-internal-token') token: string, @Body() data: LeadMessage): Promise<any> {
    this.assertAuth(token);
    return this.appService.automationCancel(data);
  }

  @Post('completed')
  async completed(@Headers('x-internal-token') token: string, @Body() data: LeadMessage): Promise<any> {
    this.assertAuth(token);
    return this.appService.processCompleted(data);
  }

  @Post('events-trigger')
  async eventsTrigger(@Headers('x-internal-token') token: string, @Body() data: EventsTrigger): Promise<any> {
    this.assertAuth(token);
    return this.appService.processEventTrigger(data);
  }

  @Post('target-achieved')
  async targetAchieved(@Headers('x-internal-token') token: string, @Body() data: EventsTarget): Promise<any> {
    this.assertAuth(token);
    return this.appService.targetAchieved(data);
  }
}
