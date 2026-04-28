import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { PublicRoute } from '../authz/public-route.decorator';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { SetupService } from './setup.service';
import { AdvanceStepDto } from './dtos/advance-step.dto';
import { TestSmtpDto } from './dtos/test-smtp.dto';
import { HealthCheckResult } from './dtos/health-check-result.dto';
import { TestSendgridDto } from './dtos/test-sendgrid.dto';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @PublicRoute()
  getStatus() {
    return this.setupService.getStatus();
  }

  @Get('health-check')
  @PublicRoute()
  async healthCheck(@IpAddress() ip?: string): Promise<HealthCheckResult> {
    this.setupService.enforceHealthCheckRateLimit(ip);
    const status = await this.setupService.getStatus();
    if (status.configured) throw new BadRequestException('Setup already completed');
    return this.setupService.checkHealth();
  }

  @Post('advance')
  @PublicRoute()
  advance(@Body() dto: AdvanceStepDto, @IpAddress() ip?: string) {
    return this.setupService.advanceStep(dto, ip);
  }

  @Post('test-smtp')
  @PublicRoute()
  testSmtp(@Body() dto: TestSmtpDto, @IpAddress() ipAddress?: string) {
    return this.setupService.testSmtp(dto, ipAddress);
  }

  @Post('test-sendgrid')
  @PublicRoute()
  testSendgrid(@Body() dto: TestSendgridDto, @IpAddress() ipAddress?: string) {
    return this.setupService.testSendgrid(dto, ipAddress);
  }
}
