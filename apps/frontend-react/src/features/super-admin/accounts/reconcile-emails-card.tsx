import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  reconcileGateway,
  type AmbiguousMatch,
  type ApplyResolution,
  type ReconcileItemRow,
  type ReconcileSessionProgress,
} from './reconcile-gateway';

/**
 * Reconcile imported masked emails against a raw-email CSV export from BMS
 * Enterprise — batched flow over a server-side session.
 *
 * The CSV is uploaded and matched ONCE (create session). Everything after is
 * incremental and quantified: auto matches apply in operator-sized chunks,
 * ambiguous cases are reviewed in pages, and bulk strategies (best-name /
 * skip-remaining) clear the long tail. Progress survives page reloads — the
 * card restores the session on mount without re-uploading the CSV.
 */

// Client-side ceiling below the 64mb accepted by nginx/msgops-api on the
// /imports routes: the CSV travels embedded in a JSON string, so escaping
// inflates the request body past the raw file size.
const MAX_CSV_FILE_MB = 50;

const AUTO_CHUNK_OPTIONS = [1000, 5000, 10000];
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const THRESHOLD_OPTIONS = [
  { value: 0.8, labelKey: 'thresholdHigh' },
  { value: 0.6, labelKey: 'thresholdMedium' },
  { value: 0.5, labelKey: 'thresholdLow' },
] as const;

// Columns the backend refuses to process without (email-reconcile.service.ts):
// email keys the mask match, created_at and the name signal disambiguate
// collisions. The name signal accepts either a `name` column or the
// first_name/last_name pair. Locked in the upload form.
const ALWAYS_REQUIRED_COLUMNS = ['email', 'created_at'];
const NAME_SIGNAL_COLUMNS = ['name', 'first_name', 'last_name'];

function hasNameSignal(columns: string[]): boolean {
  return columns.includes('name') || (columns.includes('first_name') && columns.includes('last_name'));
}

// nginx rejects oversized bodies with an HTML 413 page (no JSON `message`),
// so the status code is the only reliable signal that the file was too big.
function payloadTooLargeMessage(err: any, t: TFunction): string | null {
  return err?.response?.status === 413
    ? t('superAdmin.accounts.import.reconcile.payloadTooLarge', { max: MAX_CSV_FILE_MB })
    : null;
}

function errorMessage(err: any, t: TFunction, fallback: string): string {
  // Server-side guard for the same header validation the form enforces —
  // reachable when the file is edited between selection and submit.
  if (err?.response?.data?.code === 'RECONCILE_MISSING_COLUMNS') {
    return t('superAdmin.accounts.import.reconcile.missingColumnsError', {
      columns: (err.response.data.missing ?? []).join(', '),
    });
  }
  return payloadTooLargeMessage(err, t) ?? err?.response?.data?.message ?? fallback;
}

// Header line of the CSV → normalized column names (same normalization the
// backend applies: trim, lowercase, quotes stripped, `,`/`;` sniffed).
function parseCsvColumns(csv: string): string[] {
  const firstLine = csv.slice(0, csv.indexOf('\n') === -1 ? csv.length : csv.indexOf('\n')).replace(/\r$/, '');
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  return firstLine
    .split(delimiter)
    .map((c) => c.trim().replace(/^"|"$/g, '').trim().toLowerCase())
    .filter((c) => c.length > 0);
}

export function ReconcileEmailsCard({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const sessionQuery = useQuery({
    queryKey: ['reconcile-session', jobId],
    queryFn: () => reconcileGateway.getSession(jobId),
  });

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="font-medium">{t('superAdmin.accounts.import.reconcile.title')}</h3>
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.reconcile.description')}</p>
      </div>
      {sessionQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : sessionQuery.data ? (
        <SessionView jobId={jobId} progress={sessionQuery.data} />
      ) : (
        <UploadPanel jobId={jobId} />
      )}
    </Card>
  );
}

// ─── Step 1: upload + one-time processing ────────────────────────────────────

function UploadPanel({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  // Optional columns the operator unchecked — travels as ignoreColumns.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const missingColumns = csv
    ? [
        ...(hasNameSignal(columns) ? [] : [t('superAdmin.accounts.import.reconcile.columnNameGroup')]),
        ...ALWAYS_REQUIRED_COLUMNS.filter((c) => !columns.includes(c)),
      ]
    : [];

  const createMut = useMutation({
    mutationFn: (csvText: string) => reconcileGateway.createSession(jobId, csvText, [...deselected]),
    onSuccess: (progress) => {
      queryClient.setQueryData(['reconcile-session', jobId], progress);
    },
    onError: (err: any) => {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.sessionCreateError')));
    },
  });

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_CSV_FILE_MB * 1024 * 1024) {
      toast.error(
        t('superAdmin.accounts.import.reconcile.fileTooLarge', {
          size: (file.size / (1024 * 1024)).toFixed(1),
          max: MAX_CSV_FILE_MB,
        }),
      );
      e.target.value = '';
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsv(text);
      setColumns(parseCsvColumns(text));
      setDeselected(new Set());
    };
    reader.onerror = () => toast.error(t('superAdmin.accounts.import.reconcile.fileReadError'));
    reader.readAsText(file);
  };

  const toggleColumn = (column: string, checked: boolean) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(column);
      else next.add(column);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={createMut.isPending}>
          {t('superAdmin.accounts.import.reconcile.selectCsv')}
        </Button>
        {fileName && <span className="text-muted-foreground text-xs">{fileName}</span>}
        <Button onClick={() => csv && createMut.mutate(csv)} disabled={!csv || missingColumns.length > 0 || createMut.isPending}>
          {createMut.isPending
            ? t('superAdmin.accounts.import.reconcile.processingCsv')
            : t('superAdmin.accounts.import.reconcile.processCsv')}
        </Button>
      </div>

      {csv && columns.length > 0 && (
        <div className="space-y-2 rounded border p-3">
          <h4 className="text-sm font-medium">{t('superAdmin.accounts.import.reconcile.columnsDetected')}</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {columns.map((column) => {
              // Name-signal columns are never deselectable either — the
              // backend refuses to ignore them (they feed the match).
              const required = ALWAYS_REQUIRED_COLUMNS.includes(column) || NAME_SIGNAL_COLUMNS.includes(column);
              return (
                <label key={column} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={required || !deselected.has(column)}
                    disabled={required}
                    onCheckedChange={(checked) => toggleColumn(column, checked === true)}
                  />
                  <span className="font-mono">{column}</span>
                  <Badge variant={required ? 'default' : 'outline'} className="px-1.5 py-0 text-[10px]">
                    {required
                      ? t('superAdmin.accounts.import.reconcile.columnRequired')
                      : t('superAdmin.accounts.import.reconcile.columnOptional')}
                  </Badge>
                </label>
              );
            })}
          </div>
          {missingColumns.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>{t('superAdmin.accounts.import.reconcile.columnsMissingTitle')}</AlertTitle>
              <AlertDescription>
                {t('superAdmin.accounts.import.reconcile.columnsMissing', { columns: missingColumns.join(', ') })}
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.columnsIgnoredHint')}</p>
          )}
        </div>
      )}

      <p className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.uploadHint')}</p>
    </div>
  );
}

// ─── Step 2: quantified batch processing ─────────────────────────────────────

function SessionView({ jobId, progress }: { jobId: string; progress: ReconcileSessionProgress }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reconcile-session', jobId] });
    queryClient.invalidateQueries({ queryKey: ['reconcile-ambiguous', jobId] });
    queryClient.invalidateQueries({ queryKey: ['reconcile-items', jobId] });
  };

  const onDiscard = async () => {
    if (!window.confirm(t('superAdmin.accounts.import.reconcile.discardConfirm'))) return;
    try {
      await reconcileGateway.deleteSession(jobId);
      refresh();
    } catch (err: any) {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.sessionError')));
    }
  };

  return (
    <div className="space-y-5">
      <SummaryGrid progress={progress} />
      <ItemsSection jobId={jobId} />
      <AutoSection jobId={jobId} progress={progress} onProgress={refresh} />
      {progress.ambiguous.total > 0 && (
        <>
          <BulkSection jobId={jobId} progress={progress} onProgress={refresh} />
          <AmbiguousSection jobId={jobId} progress={progress} onProgress={refresh} />
        </>
      )}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDiscard}>
          {t('superAdmin.accounts.import.reconcile.discardSession')}
        </Button>
      </div>
    </div>
  );
}

function SummaryGrid({ progress }: { progress: ReconcileSessionProgress }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
      <Stat label={t('superAdmin.accounts.import.reconcile.statCsvRows')} value={progress.csvRows} />
      <Stat label={t('superAdmin.accounts.import.reconcile.statContactsMasked')} value={progress.contactsMasked} />
      <Stat label={t('superAdmin.accounts.import.reconcile.statAuto')} value={progress.auto.total} />
      <Stat label={t('superAdmin.accounts.import.reconcile.statAmbiguous')} value={progress.ambiguous.total} variant="warning" />
      <Stat label={t('superAdmin.accounts.import.reconcile.statNoMatch')} value={progress.noMatches} variant="warning" />
      <Stat label={t('superAdmin.accounts.import.reconcile.statAlreadyClean')} value={progress.alreadyClean} variant="muted" />
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant?: 'warning' | 'muted' }) {
  const color = variant === 'warning' ? 'text-amber-600 dark:text-amber-400' : variant === 'muted' ? 'text-muted-foreground' : '';
  return (
    <div className="bg-secondary/30 rounded p-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function AutoSection({ jobId, progress, onProgress }: { jobId: string; progress: ReconcileSessionProgress; onProgress: () => void }) {
  const { t } = useTranslation();
  const [chunkSize, setChunkSize] = useState(5000);
  const [running, setRunning] = useState(false);
  const [reopening, setReopening] = useState(false);
  const runningRef = useRef(false);

  const { auto } = progress;
  // Conflicts are settled as far as the automatic pass goes — they count as
  // progress, not as work left to run.
  const done = auto.applied + auto.failed + auto.conflict;
  const pct = auto.total === 0 ? 100 : Math.round((done / auto.total) * 100);

  const run = async () => {
    runningRef.current = true;
    setRunning(true);
    try {
      // Chunked loop: each call applies `chunkSize` contacts and reports back,
      // so progress is visible and the operator can pause between chunks.
      while (runningRef.current) {
        const result = await reconcileGateway.applyAuto(jobId, chunkSize);
        onProgress();
        if (result.remaining === 0) break;
      }
    } catch (err: any) {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.applyError')));
    } finally {
      runningRef.current = false;
      setRunning(false);
      onProgress();
    }
  };

  const stop = () => {
    runningRef.current = false;
  };

  // Conflicting items are reopened once the operator has freed the disputed
  // addresses (deleting the duplicate contact, for instance) — they go back to
  // pending and the next run picks them up.
  const reopen = async () => {
    setReopening(true);
    try {
      const result = await reconcileGateway.reopenConflicts(jobId);
      toast.success(t('superAdmin.accounts.import.reconcile.conflictsReopened', { count: result.reopened }));
    } catch (err: any) {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.applyError')));
    } finally {
      setReopening(false);
      onProgress();
    }
  };

  const conflicts = auto.conflict + progress.ambiguous.conflict;

  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('superAdmin.accounts.import.reconcile.autoTitle')}</h4>
        <span className="text-muted-foreground text-xs">
          {t('superAdmin.accounts.import.reconcile.autoProgress', {
            applied: auto.applied.toLocaleString(),
            total: auto.total.toLocaleString(),
          })}
          {auto.failed > 0 && ` · ${t('superAdmin.accounts.import.reconcile.autoFailed', { failed: auto.failed.toLocaleString() })}`}
          {auto.conflict > 0 && ` · ${t('superAdmin.accounts.import.reconcile.autoConflicts', { count: auto.conflict.toLocaleString() })}`}
        </span>
      </div>
      <Progress value={pct} />
      {conflicts > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.conflictsHint', { count: conflicts.toLocaleString() })}</p>
          <Button size="sm" variant="outline" onClick={reopen} disabled={reopening || running}>
            {t('superAdmin.accounts.import.reconcile.reopenConflicts')}
          </Button>
        </div>
      )}
      {auto.pending === 0 ? (
        <p className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.autoDone')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.chunkSize')}</span>
          <Select value={String(chunkSize)} onValueChange={(v) => setChunkSize(Number(v))} disabled={running}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_CHUNK_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {running ? (
            <Button size="sm" variant="outline" onClick={stop}>
              {t('superAdmin.accounts.import.reconcile.applyAutoStop')}
            </Button>
          ) : (
            <Button size="sm" onClick={run}>
              {t('superAdmin.accounts.import.reconcile.applyAutoStart')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function BulkSection({ jobId, progress, onProgress }: { jobId: string; progress: ReconcileSessionProgress; onProgress: () => void }) {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState(0.6);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const pending = progress.ambiguous.pending;

  const runBestName = async () => {
    runningRef.current = true;
    setRunning(true);
    let resolved = 0;
    let unresolved = 0;
    try {
      // Single sweep over the pending set — the id cursor skips items already
      // examined and left pending, so the loop always terminates.
      let afterId: string | undefined;
      while (runningRef.current) {
        const result = await reconcileGateway.bulkResolve(jobId, { strategy: 'best-name', threshold, limit: 5000, afterId });
        resolved += result.resolved;
        unresolved += result.unresolved;
        onProgress();
        if (!result.nextAfterId) break;
        afterId = result.nextAfterId;
      }
      toast.success(
        t('superAdmin.accounts.import.reconcile.bulkBestNameDone', {
          resolved: resolved.toLocaleString(),
          unresolved: unresolved.toLocaleString(),
        }),
      );
    } catch (err: any) {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.applyError')));
    } finally {
      runningRef.current = false;
      setRunning(false);
      onProgress();
    }
  };

  const skipRemaining = async () => {
    if (!window.confirm(t('superAdmin.accounts.import.reconcile.skipRemainingConfirm', { count: pending.toLocaleString() }))) return;
    try {
      const result = await reconcileGateway.bulkResolve(jobId, { strategy: 'skip-remaining' });
      toast.success(t('superAdmin.accounts.import.reconcile.skipRemainingDone', { count: result.resolved.toLocaleString() }));
      onProgress();
    } catch (err: any) {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.applyError')));
    }
  };

  if (pending === 0) return null;

  return (
    <div className="space-y-2 rounded border p-3">
      <h4 className="text-sm font-medium">{t('superAdmin.accounts.import.reconcile.bulkTitle')}</h4>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.bulkThreshold')}</span>
        <Select value={String(threshold)} onValueChange={(v) => setThreshold(Number(v))} disabled={running}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THRESHOLD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {t(`superAdmin.accounts.import.reconcile.${option.labelKey}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="secondary" onClick={runBestName} disabled={running}>
          {running
            ? t('superAdmin.accounts.import.reconcile.bulkBestNameRunning')
            : t('superAdmin.accounts.import.reconcile.bulkBestName')}
        </Button>
        <Button size="sm" variant="outline" onClick={skipRemaining} disabled={running}>
          {t('superAdmin.accounts.import.reconcile.skipRemaining')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.bulkHint')}</p>
    </div>
  );
}

function AmbiguousSection({ jobId, progress, onProgress }: { jobId: string; progress: ReconcileSessionProgress; onProgress: () => void }) {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(25);
  const [offset, setOffset] = useState(0);
  // contactId → csvRowNumber|null (null = skip). Cleared on every save/page move.
  const [decisions, setDecisions] = useState<Record<number, number | null>>({});
  const [search, setSearch] = useState('');
  // Debounced copy of `search` — the query only refires after typing settles.
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const pageQuery = useQuery({
    queryKey: ['reconcile-ambiguous', jobId, offset, pageSize, q],
    queryFn: () => reconcileGateway.ambiguousPage(jobId, offset, pageSize, q || undefined),
  });

  const resolveMut = useMutation({
    mutationFn: (resolutions: ApplyResolution[]) => reconcileGateway.resolve(jobId, resolutions),
    onSuccess: (result) => {
      toast.success(
        t('superAdmin.accounts.import.reconcile.decisionsSaved', {
          applied: result.applied,
          skipped: result.skipped,
        }),
      );
      if (result.failures.length > 0) {
        toast.error(
          t('superAdmin.accounts.import.reconcile.decisionsFailed', {
            count: result.failures.length,
            reason: result.failures[0].reason,
          }),
        );
      }
      setDecisions({});
      // Resolved items leave the pending set — restart from the first pending page.
      setOffset(0);
      onProgress();
    },
    onError: (err: any) => {
      toast.error(errorMessage(err, t, t('superAdmin.accounts.import.reconcile.applyError')));
    },
  });

  // email → contactId holding an unsaved pick for it on this page. One email
  // reconciles one contact, so a pick blocks the same candidate everywhere
  // else until saved or changed (the server enforces the same rule on apply).
  const pageItems = pageQuery.data?.items;
  const pickedEmails = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of pageItems ?? []) {
      const row = decisions[item.contactId];
      if (typeof row !== 'number') continue;
      const candidate = item.candidates.find((c) => c.csvRowNumber === row);
      if (candidate) map.set(candidate.csvEmail.toLowerCase(), item.contactId);
    }
    return map;
  }, [pageItems, decisions]);

  const { ambiguous } = progress;
  if (ambiguous.pending === 0) {
    return (
      <Alert>
        <AlertTitle>{t('superAdmin.accounts.import.reconcile.ambiguousTitle')}</AlertTitle>
        <AlertDescription>
          {t('superAdmin.accounts.import.reconcile.ambiguousAllDone', {
            applied: ambiguous.applied.toLocaleString(),
            skipped: ambiguous.skipped.toLocaleString(),
          })}
        </AlertDescription>
      </Alert>
    );
  }

  const decidedCount = Object.keys(decisions).length;
  const totalPending = pageQuery.data?.totalPending ?? ambiguous.pending;
  const items = pageQuery.data?.items ?? [];

  const onSave = () => {
    const payload: ApplyResolution[] = Object.entries(decisions).map(([cid, row]) => ({
      contactId: Number(cid),
      csvRowNumber: row,
    }));
    if (payload.length > 0) resolveMut.mutate(payload);
  };

  return (
    <div className="space-y-3 rounded border p-3">
      <div>
        <h4 className="text-sm font-medium">{t('superAdmin.accounts.import.reconcile.ambiguousTitle')}</h4>
        <p className="text-muted-foreground text-sm">
          {t('superAdmin.accounts.import.reconcile.ambiguousPendingHeader', {
            pending: ambiguous.pending.toLocaleString(),
            total: ambiguous.total.toLocaleString(),
          })}
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('superAdmin.accounts.import.reconcile.searchPlaceholder')}
        className="h-8"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">{t('superAdmin.accounts.import.reconcile.pageSize')}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setOffset(0);
            setDecisions({});
          }}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => {
              setOffset(Math.max(0, offset - pageSize));
              setDecisions({});
            }}
          >
            {t('superAdmin.accounts.import.reconcile.prevPage')}
          </Button>
          <span className="text-muted-foreground text-xs">
            {t('superAdmin.accounts.import.reconcile.pageIndicator', {
              from: Math.min(offset + 1, totalPending).toLocaleString(),
              to: Math.min(offset + pageSize, totalPending).toLocaleString(),
              total: totalPending.toLocaleString(),
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + pageSize >= totalPending}
            onClick={() => {
              setOffset(offset + pageSize);
              setDecisions({});
            }}
          >
            {t('superAdmin.accounts.import.reconcile.nextPage')}
          </Button>
        </div>
      </div>

      {pageQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.reconcile.searchNoResults')}</p>
      ) : (
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {items.map((item) => (
            <AmbiguousItem
              key={item.contactId}
              item={item}
              picked={decisions[item.contactId]}
              pickedEmails={pickedEmails}
              onResolve={(csvRowNumber) =>
                setDecisions((prev) => {
                  // Clicking the current pick (or skip) again toggles it off —
                  // back to "undecided", freeing the email for other items.
                  if (item.contactId in prev && prev[item.contactId] === csvRowNumber) {
                    const next = { ...prev };
                    delete next[item.contactId];
                    return next;
                  }
                  return { ...prev, [item.contactId]: csvRowNumber };
                })
              }
            />
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={decidedCount === 0 || resolveMut.isPending}>
          {resolveMut.isPending
            ? t('superAdmin.accounts.import.reconcile.applying')
            : t('superAdmin.accounts.import.reconcile.saveDecisions', { count: decidedCount })}
        </Button>
      </div>
    </div>
  );
}

function AmbiguousItem({
  item,
  picked,
  pickedEmails,
  onResolve,
}: {
  item: AmbiguousMatch;
  picked: number | null | undefined;
  pickedEmails: Map<string, number>;
  onResolve: (csvRowNumber: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 rounded border p-3">
      <div className="text-sm">
        <span className="font-mono">{item.currentEmail}</span>
        {item.contactName && <span className="text-muted-foreground"> · {item.contactName}</span>}
        {item.candidatesTotal > item.candidates.length && (
          <span className="text-muted-foreground text-xs">
            {' '}
            (
            {t('superAdmin.accounts.import.reconcile.candidatesShown', {
              shown: item.candidates.length,
              total: item.candidatesTotal,
            })}
            )
          </span>
        )}
      </div>
      <div className="space-y-1">
        {item.candidates.map((candidate) => {
          const pickedBy = pickedEmails.get(candidate.csvEmail.toLowerCase());
          // An email reconciles ONE contact: blocked when already applied to
          // another contact (server-computed) or picked on another item of
          // this page (unsaved local decision).
          const blocked = candidate.usedByContactId !== undefined || (pickedBy !== undefined && pickedBy !== item.contactId);
          return (
            <button
              type="button"
              key={candidate.csvRowNumber}
              disabled={blocked}
              onClick={() => onResolve(candidate.csvRowNumber)}
              className={`flex w-full items-center justify-between rounded border p-2 text-left text-xs transition ${
                blocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-secondary/50'
              } ${picked === candidate.csvRowNumber ? 'border-primary bg-secondary' : ''}`}
            >
              <div>
                <div className="font-mono">{candidate.csvEmail}</div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-1">
                  {candidate.csvName}
                  {candidate.score > 0 && (
                    <span> · {t('superAdmin.accounts.import.reconcile.score', { pct: Math.round(candidate.score * 100) })}</span>
                  )}
                  {(candidate.timeMatch ?? 0) > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {candidate.timeMatch === 2
                        ? t('superAdmin.accounts.import.reconcile.timeExact')
                        : t('superAdmin.accounts.import.reconcile.timeSameDay')}
                    </Badge>
                  )}
                  {candidate.usedByContactId !== undefined ? (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {t('superAdmin.accounts.import.reconcile.usedByContact', { id: candidate.usedByContactId })}
                    </Badge>
                  ) : (
                    blocked && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {t('superAdmin.accounts.import.reconcile.pickedElsewhere')}
                      </Badge>
                    )
                  )}
                </div>
              </div>
              {picked === candidate.csvRowNumber && <Badge variant="default">{t('superAdmin.accounts.import.reconcile.picked')}</Badge>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onResolve(null)}
          className={`hover:bg-secondary/50 flex w-full items-center justify-between rounded border p-2 text-left text-xs transition ${
            picked === null ? 'border-amber-500 bg-secondary' : ''
          }`}
        >
          <span className="text-muted-foreground">{t('superAdmin.accounts.import.reconcile.skipThis')}</span>
          {picked === null && <Badge variant="outline">{t('superAdmin.accounts.import.reconcile.skipped')}</Badge>}
        </button>
      </div>
    </div>
  );
}

const ITEMS_PAGE_SIZE = 25;

// Flat, searchable "who matched what" table over every session item — auto
// picks and ambiguous outcomes alike. Read-only: resolution stays in the
// ambiguous queue above; this section exists for visibility and lookup.
function ItemsSection({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'auto' | 'ambiguous'>('all');
  const [status, setStatus] = useState<'all' | 'pending' | 'applied' | 'skipped' | 'failed' | 'conflict'>('all');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  const pageQuery = useQuery({
    queryKey: ['reconcile-items', jobId, offset, q, kind, status],
    queryFn: () =>
      reconcileGateway.itemsPage(jobId, {
        offset,
        limit: ITEMS_PAGE_SIZE,
        q: q || undefined,
        kind: kind === 'all' ? undefined : kind,
        status: status === 'all' ? undefined : status,
      }),
  });

  const total = pageQuery.data?.total ?? 0;
  const items = pageQuery.data?.items ?? [];

  return (
    <div className="space-y-3 rounded border p-3">
      <div>
        <h4 className="text-sm font-medium">{t('superAdmin.accounts.import.reconcile.itemsTitle')}</h4>
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.reconcile.itemsHint')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('superAdmin.accounts.import.reconcile.searchPlaceholder')}
          className="h-8 min-w-48 flex-1"
        />
        <Select
          value={kind}
          onValueChange={(v) => {
            setKind(v as typeof kind);
            setOffset(0);
          }}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('superAdmin.accounts.import.reconcile.kindAll')}</SelectItem>
            <SelectItem value="auto">{t('superAdmin.accounts.import.reconcile.kindAuto')}</SelectItem>
            <SelectItem value="ambiguous">{t('superAdmin.accounts.import.reconcile.kindAmbiguous')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setOffset(0);
          }}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('superAdmin.accounts.import.reconcile.statusAll')}</SelectItem>
            <SelectItem value="pending">{t('superAdmin.accounts.import.reconcile.statusPending')}</SelectItem>
            <SelectItem value="applied">{t('superAdmin.accounts.import.reconcile.statusApplied')}</SelectItem>
            <SelectItem value="skipped">{t('superAdmin.accounts.import.reconcile.statusSkipped')}</SelectItem>
            <SelectItem value="failed">{t('superAdmin.accounts.import.reconcile.statusFailed')}</SelectItem>
            <SelectItem value="conflict">{t('superAdmin.accounts.import.reconcile.statusConflict')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pageQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.reconcile.searchNoResults')}</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('superAdmin.accounts.import.reconcile.colContact')}</TableHead>
                <TableHead>{t('superAdmin.accounts.import.reconcile.colCurrentEmail')}</TableHead>
                <TableHead>{t('superAdmin.accounts.import.reconcile.colNewEmail')}</TableHead>
                <TableHead>{t('superAdmin.accounts.import.reconcile.colType')}</TableHead>
                <TableHead>{t('superAdmin.accounts.import.reconcile.colStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.contactId}>
                  <TableCell className="text-xs">
                    {item.contactName || <span className="text-muted-foreground">#{item.contactId}</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.currentEmail}</TableCell>
                  <TableCell className="font-mono text-xs">{item.newEmail ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {item.kind === 'auto'
                      ? t('superAdmin.accounts.import.reconcile.kindAuto')
                      : t('superAdmin.accounts.import.reconcile.kindAmbiguous')}
                  </TableCell>
                  <TableCell className="text-xs">
                    <ItemStatusBadge status={item.status} />
                    {(item.status === 'failed' || item.status === 'conflict') && item.failureReason && (
                      <div className="text-muted-foreground mt-0.5 max-w-56 truncate text-[10px]" title={item.failureReason}>
                        {item.failureReason}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - ITEMS_PAGE_SIZE))}>
          {t('superAdmin.accounts.import.reconcile.prevPage')}
        </Button>
        <span className="text-muted-foreground text-xs">
          {t('superAdmin.accounts.import.reconcile.pageIndicator', {
            from: Math.min(offset + 1, total).toLocaleString(),
            to: Math.min(offset + ITEMS_PAGE_SIZE, total).toLocaleString(),
            total: total.toLocaleString(),
          })}
        </span>
        <Button size="sm" variant="outline" disabled={offset + ITEMS_PAGE_SIZE >= total} onClick={() => setOffset(offset + ITEMS_PAGE_SIZE)}>
          {t('superAdmin.accounts.import.reconcile.nextPage')}
        </Button>
      </div>
    </div>
  );
}

function ItemStatusBadge({ status }: { status: ReconcileItemRow['status'] }) {
  const { t } = useTranslation();
  // A conflict is not an error — it is a decision waiting to be made, so it
  // reads as a warning rather than as a destructive failure.
  const variant =
    status === 'applied' ? 'default' : status === 'failed' ? 'destructive' : status === 'skipped' ? 'outline' : status === 'conflict' ? 'outline' : 'secondary';
  const label =
    status === 'applied'
      ? t('superAdmin.accounts.import.reconcile.statusApplied')
      : status === 'failed'
        ? t('superAdmin.accounts.import.reconcile.statusFailed')
        : status === 'skipped'
          ? t('superAdmin.accounts.import.reconcile.statusSkipped')
          : status === 'conflict'
            ? t('superAdmin.accounts.import.reconcile.statusConflict')
            : t('superAdmin.accounts.import.reconcile.statusPending');
  return <Badge variant={variant}>{label}</Badge>;
}
