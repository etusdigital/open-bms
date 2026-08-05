import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
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
  ReopenConflictsResult,
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

  @ApiOperation({
    summary: 'Create (or replace) the reconcile session for an import job',
    description: `Parses the CSV once, matches it against the account's masked contacts and persists the outcome
    as session items: kind=auto (decided) and kind=ambiguous (operator review). Replaces any previous session for
    the job, atomically. Auto picks whose address already belongs to another contact are stored as status=conflict.
    Requires columns email, created_at and a name signal (name, or first_name + last_name) — otherwise 400 with
    code RECONCILE_MISSING_COLUMNS and the missing list. Returns the session progress counters.`,
  })
  @Post('/imports/:jobId/reconcile/session')
  @RequireSuperAdmin()
  createReconcileSession(@Param('jobId') jobId: string, @Body() body: ReconcileSessionCreateDto): Promise<ReconcileSessionProgress> {
    return this.reconcileSessionService.createSession(jobId, body.csv, body.ignoreColumns);
  }

  @ApiOperation({
    summary: 'Get reconcile session progress',
    description: `Counters recomputed from item statuses (auto/ambiguous × pending|applied|skipped|failed|conflict),
    plus the CSV totals and the no-match sample. Safe to poll; 404 when the job has no session.`,
  })
  @Get('/imports/:jobId/reconcile/session')
  @RequireSuperAdmin()
  getReconcileSession(@Param('jobId') jobId: string): Promise<ReconcileSessionProgress> {
    return this.reconcileSessionService.getProgress(jobId);
  }

  @ApiOperation({
    summary: 'Page through the ambiguous review queue',
    description: `Items awaiting an operator decision (status pending or conflict), each with its top candidates
    sorted by name similarity. Candidates already consumed in this session are annotated with usedByContactId so
    the UI can block a duplicate pick.`,
  })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Defaults to 50, capped at 200.' })
  @ApiQuery({ name: 'q', required: false, description: 'Case-insensitive search over contact name, emails and candidates.' })
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
  @ApiOperation({
    summary: 'List session items ("who matched what")',
    description: `Flat, searchable listing over every item of the session, whatever its kind or status. Read-only —
    resolution happens through /ambiguous and /resolve.`,
  })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Defaults to 50, capped at 200.' })
  @ApiQuery({ name: 'q', required: false, description: 'Case-insensitive search over contact name, emails and candidates.' })
  @ApiQuery({ name: 'kind', required: false, enum: ['auto', 'ambiguous'] })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'applied', 'skipped', 'failed', 'conflict'] })
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
    const statuses = ['pending', 'applied', 'skipped', 'failed', 'conflict'] as const;
    return this.reconcileSessionService.getItemsPage(jobId, {
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(200, Math.max(1, Number(limit) || 50)),
      q: (q ?? '').slice(0, 200),
      kind: kinds.find((k) => k === kind),
      status: statuses.find((s) => s === status),
    });
  }

  @ApiOperation({
    summary: 'Apply a page of operator decisions',
    description: `Each resolution is a contactId plus the csvRowNumber picked among the item's candidates, or null to
    skip the contact. Applies immediately, so the payload is bounded to one UI page (500). Items in pending or
    conflict are eligible; already decided ones come back in the invalid counter.`,
  })
  @Post('/imports/:jobId/reconcile/session/resolve')
  @RequireSuperAdmin()
  resolveReconcileBatch(@Param('jobId') jobId: string, @Body() body: ReconcileResolveBatchDto): Promise<ResolveBatchResult> {
    return this.reconcileSessionService.resolveBatch(jobId, body.resolutions);
  }

  @ApiOperation({
    summary: 'Apply the next chunk of automatic matches',
    description: `Writes up to \`limit\` pending auto items. The client loops while remaining > 0. Items whose address
    is already taken come back as conflicts (not failures) and leave the automatic queue for manual resolution.`,
  })
  @Post('/imports/:jobId/reconcile/session/apply-auto')
  @RequireSuperAdmin()
  applyReconcileAutoChunk(@Param('jobId') jobId: string, @Body() body: ReconcileApplyAutoDto): Promise<ApplyAutoChunkResult> {
    return this.reconcileSessionService.applyAutoChunk(jobId, body.limit);
  }

  @ApiOperation({
    summary: 'Clear the ambiguous tail in bulk',
    description: `best-name applies the top candidate when it clears \`threshold\` and strictly beats the runner-up,
    never consuming an address another contact already owns; anything else stays pending. skip-remaining marks the
    whole review queue as skipped. Paginate with the returned nextAfterId cursor.`,
  })
  @Post('/imports/:jobId/reconcile/session/bulk-resolve')
  @RequireSuperAdmin()
  bulkResolveReconcile(@Param('jobId') jobId: string, @Body() body: ReconcileBulkResolveDto): Promise<BulkResolveResult> {
    return this.reconcileSessionService.bulkResolve(jobId, body.strategy, body.threshold, body.limit, body.afterId);
  }

  @ApiOperation({
    summary: 'Reopen conflicting items',
    description: `Puts every item parked in conflict back to pending — for after the operator frees the disputed
    addresses (removing duplicate contacts, for instance). Items that still conflict simply return to conflict on
    the next attempt.`,
  })
  @Post('/imports/:jobId/reconcile/session/reopen-conflicts')
  @RequireSuperAdmin()
  reopenReconcileConflicts(@Param('jobId') jobId: string): Promise<ReopenConflictsResult> {
    return this.reconcileSessionService.reopenConflicts(jobId);
  }

  @ApiOperation({
    summary: 'Delete the reconcile session',
    description: 'Drops the working set (items cascade). Contacts already reconciled keep their new address.',
  })
  @Delete('/imports/:jobId/reconcile/session')
  @RequireSuperAdmin()
  async deleteReconcileSession(@Param('jobId') jobId: string): Promise<{ deleted: true }> {
    await this.reconcileSessionService.deleteSession(jobId);
    return { deleted: true };
  }
}
