import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RequireSuperAdmin } from '../authz/require-super-admin.decorator';
import { EnterpriseImportService } from './enterprise-import.service';
import { ImportAccountDto, ResumeImportDto } from './dtos/import-account.dto';
import { ImportStatusDto } from './dtos/import-status.dto';
import { EnterpriseImportEnabledGuard } from './enterprise-import.guard';

@Controller()
@UseGuards(EnterpriseImportEnabledGuard)
export class EnterpriseImportController {
  constructor(private readonly service: EnterpriseImportService) {}

  // Creates the account with skipDefaults:true and enqueues the import job.
  @Post('/accounts/import')
  @RequireSuperAdmin()
  importAccount(@Body() dto: ImportAccountDto, @Req() req: any): Promise<{ accountId: number; jobId: string }> {
    // userId=0 would violate the users.id FK (imported account with no owner).
    // If the principal context is missing, it is an auth failure — do not fall
    // back to 0.
    const userId = req?.authzContext?.userId ?? req?.user?.id;
    if (!userId || typeof userId !== 'number') {
      throw new ForbiddenException('Contexto de super-admin ausente — não é possível atribuir o dono da conta.');
    }
    return this.service.createAccountImport(dto, userId);
  }

  // Status without apiKey, polling-friendly.
  @Get('/imports/:jobId')
  @RequireSuperAdmin()
  getStatus(@Param('jobId') jobId: string): Promise<ImportStatusDto> {
    return this.service.getStatus(jobId);
  }

  @Post('/imports/:jobId/resume')
  @RequireSuperAdmin()
  resume(@Param('jobId') jobId: string, @Body() body: ResumeImportDto): Promise<{ jobId: string; status: string }> {
    return this.service.resume(jobId, body?.enterpriseApiKey);
  }
}
