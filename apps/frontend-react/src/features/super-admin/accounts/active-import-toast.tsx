import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { useImportStatus } from './use-import-status';
import { useActiveImportStore } from './active-import-store';
import { ENTITY_I18N, overallPercent, currentStepKey } from './import-progress';

const TOAST_ID = 'enterprise-import-progress';
// On success the toast auto-dismisses (with an X for early close); a failure
// stays until the user closes it (X) so the error isn't missed. Only the
// running toast is sticky (duration: Infinity), and it ends when the job does.
const DONE_DURATION_MS = 8000;

function RunningBody({ title, step, pct }: { title: string; step: string; pct: number }) {
  return (
    <div className="w-full min-w-56">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">
        {step ? `${step} · ` : ''}
        {pct}%
      </p>
      <Progress value={pct} className="mt-1.5 h-1.5" />
    </div>
  );
}

// Headless: drives a single persistent sonner toast that mirrors the active
// import job. Mounted once at the app root so it survives navigation. No "view"
// action on purpose — navigating away would yank the user out of the setup
// wizard; the full status is shown inline on the setup/super-admin screens.
export function ActiveImportToast() {
  const jobId = useActiveImportStore((s) => s.jobId);
  const clearActiveImport = useActiveImportStore((s) => s.clearActiveImport);
  // Poll whenever there's a job, exactly like the inline ImportStatusView — the
  // status endpoint is reachable during setup (where the app-store is not yet
  // "authenticated"), so gating on auth here would hide the toast in setup.
  const { data } = useImportStatus(jobId ?? undefined);
  const { t } = useTranslation();
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!jobId || !data) return;

    const pct = overallPercent(data.progress, data.status);
    const stepKey = currentStepKey(data.progress, data.checkpoint);
    const stepLabel = stepKey ? t(`superAdmin.accounts.import.entities.${ENTITY_I18N[stepKey] ?? stepKey}`) : '';

    // Skip redundant re-renders of the toast (status polls every 2s).
    const dedupe = `${data.status}:${pct}:${stepLabel}`;
    if (dedupe === lastKeyRef.current) return;
    lastKeyRef.current = dedupe;

    if (data.status === 'completed') {
      toast.success(t('superAdmin.accounts.import.toast.completed'), { id: TOAST_ID, duration: DONE_DURATION_MS, closeButton: true });
      clearActiveImport(); // acknowledged once; the success toast auto-closes
    } else if (data.status === 'failed') {
      toast.error(t('superAdmin.accounts.import.toast.failed'), { id: TOAST_ID, duration: Infinity, closeButton: true });
      clearActiveImport();
    } else {
      toast.loading(<RunningBody title={t('superAdmin.accounts.import.toast.running')} step={stepLabel} pct={pct} />, {
        id: TOAST_ID,
        duration: Infinity,
      });
    }
  }, [jobId, data, t, clearActiveImport]);

  return null;
}
