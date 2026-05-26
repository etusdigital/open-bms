import { useState, useRef, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { reconcileGateway, type AmbiguousMatch, type ApplyResolution, type ReconcilePreview } from './reconcile-gateway';

/**
 * EVO-1464 — Reconcile imported masked emails against a raw-email CSV export
 * from BMS Enterprise.
 *
 * Shows up under the import status page when the job is `completed`. Operator
 * picks the CSV, runs a dry-run preview, optionally resolves ambiguous matches
 * (multiple raw emails sharing the same mask), then commits.
 */
export function ReconcileEmailsCard({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReconcilePreview | null>(null);
  // Map of contactId → csvRowNumber|null (null = skip). Empty means "auto-pick
  // for every ambiguous, matching what preview showed."
  const [resolutions, setResolutions] = useState<Record<number, number | null>>({});

  const previewMut = useMutation({
    mutationFn: (csvText: string) => reconcileGateway.preview(jobId, csvText),
    onSuccess: (data) => {
      setPreview(data);
      setResolutions({});
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? t('superAdmin.accounts.import.reconcile.previewError'));
    },
  });

  const applyMut = useMutation({
    mutationFn: (input: { csv: string; resolutions: ApplyResolution[] }) =>
      reconcileGateway.apply(jobId, input.csv, input.resolutions),
    onSuccess: (data) => {
      toast.success(
        t('superAdmin.accounts.import.reconcile.applyDoneToast', {
          updated: data.updated,
          ambiguous: data.skippedAmbiguous,
          noMatch: data.skippedNoMatch,
        }),
      );
      // Force a fresh preview so the operator sees the post-apply state.
      if (csv) previewMut.mutate(csv);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? t('superAdmin.accounts.import.reconcile.applyError'));
    },
  });

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsv(text);
      setPreview(null);
      setResolutions({});
    };
    reader.onerror = () => toast.error(t('superAdmin.accounts.import.reconcile.fileReadError'));
    reader.readAsText(file);
  };

  const onResolveCandidate = (contactId: number, csvRowNumber: number | null) => {
    setResolutions((prev) => ({ ...prev, [contactId]: csvRowNumber }));
  };

  const onApply = () => {
    if (!csv) return;
    const payload: ApplyResolution[] = Object.entries(resolutions).map(([cid, row]) => ({
      contactId: Number(cid),
      csvRowNumber: row,
    }));
    applyMut.mutate({ csv, resolutions: payload });
  };

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="font-medium">{t('superAdmin.accounts.import.reconcile.title')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('superAdmin.accounts.import.reconcile.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          {t('superAdmin.accounts.import.reconcile.selectCsv')}
        </Button>
        {fileName && <span className="text-muted-foreground text-xs">{fileName}</span>}
        <Button
          onClick={() => csv && previewMut.mutate(csv)}
          disabled={!csv || previewMut.isPending}
        >
          {previewMut.isPending
            ? t('superAdmin.accounts.import.reconcile.previewing')
            : t('superAdmin.accounts.import.reconcile.preview')}
        </Button>
      </div>

      {preview && (
        <>
          <PreviewSummary preview={preview} />
          {preview.ambiguousSample.length > 0 && (
            <AmbiguousList
              items={preview.ambiguousSample}
              resolutions={resolutions}
              onResolve={onResolveCandidate}
              totalAmbiguous={preview.ambiguousMatches}
            />
          )}
          <div className="flex justify-end">
            <Button onClick={onApply} disabled={applyMut.isPending || preview.uniqueMatches + Object.keys(resolutions).filter((k) => resolutions[Number(k)] != null).length === 0}>
              {applyMut.isPending
                ? t('superAdmin.accounts.import.reconcile.applying')
                : t('superAdmin.accounts.import.reconcile.apply')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function PreviewSummary({ preview }: { preview: ReconcilePreview }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
      <Stat label={t('superAdmin.accounts.import.reconcile.statCsvRows')} value={preview.csvRows} />
      <Stat label={t('superAdmin.accounts.import.reconcile.statContactsMasked')} value={preview.contactsMasked} />
      <Stat label={t('superAdmin.accounts.import.reconcile.statUniqueMatches')} value={preview.uniqueMatches} />
      <Stat label={t('superAdmin.accounts.import.reconcile.statAmbiguous')} value={preview.ambiguousMatches} variant="warning" />
      <Stat label={t('superAdmin.accounts.import.reconcile.statNoMatch')} value={preview.noMatches} variant="warning" />
      <Stat label={t('superAdmin.accounts.import.reconcile.statAlreadyClean')} value={preview.alreadyClean} variant="muted" />
    </div>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant?: 'warning' | 'muted' }) {
  const color =
    variant === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : variant === 'muted'
        ? 'text-muted-foreground'
        : '';
  return (
    <div className="bg-secondary/30 rounded p-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function AmbiguousList({
  items,
  resolutions,
  onResolve,
  totalAmbiguous,
}: {
  items: AmbiguousMatch[];
  resolutions: Record<number, number | null>;
  onResolve: (contactId: number, csvRowNumber: number | null) => void;
  totalAmbiguous: number;
}) {
  const { t } = useTranslation();
  return (
    <Alert>
      <AlertTitle>{t('superAdmin.accounts.import.reconcile.ambiguousTitle')}</AlertTitle>
      <AlertDescription>
        {totalAmbiguous > items.length
          ? t('superAdmin.accounts.import.reconcile.ambiguousShownLimited', {
              shown: items.length,
              total: totalAmbiguous,
            })
          : t('superAdmin.accounts.import.reconcile.ambiguousShown', { total: totalAmbiguous })}
      </AlertDescription>
      <div className="mt-3 max-h-96 space-y-3 overflow-y-auto">
        {items.map((item) => {
          const picked = resolutions[item.contactId];
          return (
            <div key={item.contactId} className="space-y-2 rounded border p-3">
              <div className="text-sm">
                <span className="font-mono">{item.currentEmail}</span>
                {item.contactName && (
                  <span className="text-muted-foreground"> · {item.contactName}</span>
                )}
              </div>
              <div className="space-y-1">
                {item.candidates.map((c) => (
                  <button
                    type="button"
                    key={c.csvRowNumber}
                    onClick={() => onResolve(item.contactId, c.csvRowNumber)}
                    className={`hover:bg-secondary/50 flex w-full items-center justify-between rounded border p-2 text-left text-xs transition ${
                      picked === c.csvRowNumber ? 'border-primary bg-secondary' : ''
                    }`}
                  >
                    <div>
                      <div className="font-mono">{c.csvEmail}</div>
                      <div className="text-muted-foreground">{c.csvName}</div>
                    </div>
                    {picked === c.csvRowNumber && (
                      <Badge variant="default">{t('superAdmin.accounts.import.reconcile.picked')}</Badge>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onResolve(item.contactId, null)}
                  className={`hover:bg-secondary/50 flex w-full items-center justify-between rounded border p-2 text-left text-xs transition ${
                    picked === null ? 'border-amber-500 bg-secondary' : ''
                  }`}
                >
                  <span className="text-muted-foreground">
                    {t('superAdmin.accounts.import.reconcile.skipThis')}
                  </span>
                  {picked === null && (
                    <Badge variant="outline">{t('superAdmin.accounts.import.reconcile.skipped')}</Badge>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Alert>
  );
}
