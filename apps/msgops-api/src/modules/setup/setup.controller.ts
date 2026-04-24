import { Body, Controller, Get, Post } from '@nestjs/common';
import { PublicRoute } from '../authz/public-route.decorator';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { SetupService } from './setup.service';
import { AdvanceStepDto } from './dtos/advance-step.dto';
import { TestSmtpDto } from './dtos/test-smtp.dto';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @PublicRoute()
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post('advance')
  @PublicRoute()
  advance(@Body() dto: AdvanceStepDto) {
    return this.setupService.advanceStep(dto);
  }

  @Post('test-smtp')
  @PublicRoute()
  testSmtp(@Body() dto: TestSmtpDto, @IpAddress() ipAddress?: string) {
    return this.setupService.testSmtp(dto, ipAddress);
  }
}
