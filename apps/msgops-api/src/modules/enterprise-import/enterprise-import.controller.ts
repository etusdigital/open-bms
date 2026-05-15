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

  // Cria a conta com skipDefaults:true e enfileira o job de import. AC1 + AC11.
  @Post('/accounts/import')
  @RequireSuperAdmin()
  importAccount(@Body() dto: ImportAccountDto, @Req() req: any): Promise<{ accountId: number; jobId: string }> {
    // F22: userId=0 violaria a FK users.id (conta importada sem dono). Se o
    // contexto do principal não veio, é falha de auth — não inventa 0.
    const userId = req?.authzContext?.userId ?? req?.user?.id;
    if (!userId || typeof userId !== 'number') {
      throw new ForbiddenException('Contexto de super-admin ausente — não é possível atribuir o dono da conta.');
    }
    return this.service.createAccountImport(dto, userId);
  }

  // AC2/AC6: status sem apiKey, polling friendly.
  @Get('/imports/:jobId')
  @RequireSuperAdmin()
  getStatus(@Param('jobId') jobId: string): Promise<ImportStatusDto> {
    return this.service.getStatus(jobId);
  }

  // AC4: retoma do checkpoint.
  @Post('/imports/:jobId/resume')
  @RequireSuperAdmin()
  resume(@Param('jobId') jobId: string, @Body() body: ResumeImportDto): Promise<{ jobId: string; status: string }> {
    return this.service.resume(jobId, body?.enterpriseApiKey);
  }
}
