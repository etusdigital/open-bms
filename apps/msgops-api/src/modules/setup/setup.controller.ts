import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { PublicRoute } from '../authz/public-route.decorator';
import { IpAddress } from '../../decorators/ip_address.decorator';
import { SetupService } from './setup.service';
import { AdvanceStepDto } from './dtos/advance-step.dto';
import { TestSmtpDto } from './dtos/test-smtp.dto';
import { HealthCheckResult } from './dtos/health-check-result.dto';
import { TestSendgridDto } from './dtos/test-sendgrid.dto';
import { GeoIpSettingsDto } from './dtos/geoip-settings.dto';
import { AdminS3Service } from '../admin-integrations/s3/admin-s3.service';
import { S3SettingsDto } from '../admin-integrations/s3/dtos/s3-settings.dto';
import { ImportEnterpriseSetupDto } from './dtos/import-enterprise.dto';

@Controller('setup')
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly s3Service: AdminS3Service,
  ) {}

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

  // Persists the GeoIP enrichment choice (disabled / lite / advanced + creds)
  // chosen in the setup wizard. Decoupled from advance/step ordering: it can
  // run anywhere between Step 3 (Domain) and Step 6 (Health).
  @Post('geoip')
  @PublicRoute()
  saveGeoIp(@Body() dto: GeoIpSettingsDto) {
    return this.setupService.saveGeoIpSettings(dto);
  }

  // Persists S3 settings from the setup wizard step. Public because the wizard
  // runs before the operator session is guaranteed (auto-login is best-effort).
  @Post('s3')
  @PublicRoute()
  saveS3(@Body() dto: S3SettingsDto) {
    return this.s3Service.saveSettings(dto);
  }

  // PublicRoute because the wizard runs before the super-admin is logged in;
  // a manual gate in setupService rejects once the wizard is complete.
  @Post('import-enterprise')
  @PublicRoute()
  importEnterprise(@Body() dto: ImportEnterpriseSetupDto, @IpAddress() ip?: string) {
    return this.setupService.importEnterprise(dto, ip);
  }

  // PublicRoute (wizard runs before login); manual gate in the service
  // rejects once setup is complete.
  @Post('import-enterprise/reset')
  @PublicRoute()
  resetImportEnterprise() {
    return this.setupService.resetEnterpriseImport();
  }
}
