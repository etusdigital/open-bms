import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequireSuperAdmin } from '../authz/require-super-admin.decorator';
import { EnterpriseImportService } from './enterprise-import.service';
import { EmailReconcileService } from './email-reconcile.service';
import { EmailReconcileSessionService } from './email-reconcile-session.service';
import { ImportAccountDto, ResumeImportDto } from './dtos/import-account.dto';
import { ImportStatusDto } from './dtos/import-status.dto';
import { ReconcileApplyDto, ReconcilePreviewDto } from './dtos/reconcile.dto';
import { ReconcileApplyAutoDto, ReconcileBulkResolveDto, ReconcileResolveBatchDto, ReconcileSessionCreateDto } from './dtos/reconcile-session.dto';
import { EnterpriseImportEnabledGuard } from './enterprise-import.guard';
import type {
  AmbiguousPageResult,
  ApplyAutoChunkResult,
  ApplyResult,
  BulkResolveResult,
  ReconcileItemsPage,
  ReconcilePreview,
  ReconcileSessionProgress,
  ResolveBatchResult,
} from './email-reconcile.types';

@Controller()
@UseGuards(EnterpriseImportEnabledGuard)
export class EnterpriseImportController {
  constructor(
    private readonly service: EnterpriseImportService,
    private readonly reconcileService: EmailReconcileService,
    private readonly reconcileSessionService: EmailReconcileSessionService,
  ) {}

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

  // List recent import jobs (most-recent-first). Powers the dashboard list
  // on the super-admin Import page so operators don't need the UUID to find
  // a completed job.
  @Get('/imports')
  @RequireSuperAdmin()
  listJobs(): Promise<ImportStatusDto[]> {
    return this.service.listJobs();
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

  // EVO-1464 workaround — reconcile masked emails against a raw-email CSV
  // export from BMS Enterprise. Preview is dry-run; apply commits the
  // updates plus operator-picked resolutions for ambiguous matches.

  @Post('/imports/:jobId/reconcile/preview')
  @RequireSuperAdmin()
  reconcilePreview(@Param('jobId') jobId: string, @Body() body: ReconcilePreviewDto): Promise<ReconcilePreview> {
    return this.reconcileService.preview(jobId, body.csv);
  }

  @Post('/imports/:jobId/reconcile/apply')
  @RequireSuperAdmin()
  reconcileApply(@Param('jobId') jobId: string, @Body() body: ReconcileApplyDto): Promise<ApplyResult> {
    return this.reconcileService.apply(jobId, body.csv, body.resolutions);
  }

  // ── Batched reconciliation over a persisted session ──────────────────────
  // The CSV is parsed/matched once (POST session); from then on the operator
  // applies auto matches in chunks, reviews ambiguous cases in pages and can
  // bulk-resolve the tail — all without re-uploading the CSV. Progress is
  // recomputed from item statuses, so the flow survives page reloads.

  @Post('/imports/:jobId/reconcile/session')
  @RequireSuperAdmin()
  createReconcileSession(@Param('jobId') jobId: string, @Body() body: ReconcileSessionCreateDto): Promise<ReconcileSessionProgress> {
    return this.reconcileSessionService.createSession(jobId, body.csv, body.ignoreColumns);
  }

  @Get('/imports/:jobId/reconcile/session')
  @RequireSuperAdmin()
  getReconcileSession(@Param('jobId') jobId: string): Promise<ReconcileSessionProgress> {
    return this.reconcileSessionService.getProgress(jobId);
  }

  @Get('/imports/:jobId/reconcile/session/ambiguous')
  @RequireSuperAdmin()
  getReconcileAmbiguousPage(@Param('jobId') jobId: string, @Query('offset') offset?: string, @Query('limit') limit?: string, @Query('q') q?: string): Promise<AmbiguousPageResult> {
    const parsedOffset = Math.max(0, Number(offset) || 0);
    const parsedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.reconcileSessionService.getAmbiguousPage(jobId, parsedOffset, parsedLimit, (q ?? '').slice(0, 200));
  }

  // Flat "who matched what" listing over the session items — searchable by
  // contact name / masked email / applied email / candidate payload, and
  // filterable by kind and status. Read-only; resolution stays in /ambiguous.
  @Get('/imports/:jobId/reconcile/session/items')
  @RequireSuperAdmin()
  getReconcileItemsPage(
    @Param('jobId') jobId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ): Promise<ReconcileItemsPage> {
    const kinds = ['auto', 'ambiguous'] as const;
    const statuses = ['pending', 'applied', 'skipped', 'failed'] as const;
    return this.reconcileSessionService.getItemsPage(jobId, {
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(200, Math.max(1, Number(limit) || 50)),
      q: (q ?? '').slice(0, 200),
      kind: kinds.find((k) => k === kind),
      status: statuses.find((s) => s === status),
    });
  }

  @Post('/imports/:jobId/reconcile/session/resolve')
  @RequireSuperAdmin()
  resolveReconcileBatch(@Param('jobId') jobId: string, @Body() body: ReconcileResolveBatchDto): Promise<ResolveBatchResult> {
    return this.reconcileSessionService.resolveBatch(jobId, body.resolutions);
  }

  @Post('/imports/:jobId/reconcile/session/apply-auto')
  @RequireSuperAdmin()
  applyReconcileAutoChunk(@Param('jobId') jobId: string, @Body() body: ReconcileApplyAutoDto): Promise<ApplyAutoChunkResult> {
    return this.reconcileSessionService.applyAutoChunk(jobId, body.limit);
  }

  @Post('/imports/:jobId/reconcile/session/bulk-resolve')
  @RequireSuperAdmin()
  bulkResolveReconcile(@Param('jobId') jobId: string, @Body() body: ReconcileBulkResolveDto): Promise<BulkResolveResult> {
    return this.reconcileSessionService.bulkResolve(jobId, body.strategy, body.threshold, body.limit, body.afterId);
  }

  @Delete('/imports/:jobId/reconcile/session')
  @RequireSuperAdmin()
  async deleteReconcileSession(@Param('jobId') jobId: string): Promise<{ deleted: true }> {
    await this.reconcileSessionService.deleteSession(jobId);
    return { deleted: true };
  }
}
