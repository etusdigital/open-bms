import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import type { ImportProgressEntry, ImportStatus } from './import-gateway';
import { ENTITY_I18N } from './import-progress';

function pct(entry: ImportProgressEntry): number {
  if (!entry.total || entry.total === 0) return 0;
  const done = entry.done ?? 0;
  return Math.min(100, Math.round((done / entry.total) * 100));
}

export function ProgressList({
  progress,
  jobStatus,
}: {
  progress: Record<string, ImportProgressEntry>;
  jobStatus?: ImportStatus;
}) {
  const { t } = useTranslation();
  const keys = Object.keys(ENTITY_I18N);
  // Job completed ⇒ every step that ran is 100%. Some importers (e.g. messages)
  // emit only {done, page} without {total}, so pct() can't compute and the bar
  // would stay stuck at 0% even with a `completed` job. On completion we force
  // 100% so processed steps render full, matching the status.
  const jobDone = jobStatus === 'completed';
  return (
    <div className="space-y-3">
      {keys.map((k) => {
        const entry = progress[k];
        const skipped = entry?.skipped;
        const hasCounts = !!entry && (entry.done ?? 0) >= 0 && (entry.total != null || (entry.done ?? 0) > 0);
        const value = skipped || (jobDone && !!entry) ? 100 : entry ? pct(entry) : 0;
        const text = skipped
          ? t('superAdmin.accounts.import.progressSkipped', { reason: entry?.reason ?? 'n/a' })
          : hasCounts
            ? `${entry!.done ?? 0}${entry!.total ? `/${entry!.total}` : ''}${
                entry!.page ? ` (${t('superAdmin.accounts.import.progressPage', { page: entry!.page })})` : ''
              }`
            : jobDone
              ? t('superAdmin.accounts.import.progressDone')
              : t('superAdmin.accounts.import.progressPending');
        return (
          <div key={k} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span>{t(`superAdmin.accounts.import.entities.${ENTITY_I18N[k]}`)}</span>
              <span className="text-muted-foreground text-xs">{text}</span>
            </div>
            <Progress value={value} />
          </div>
        );
      })}
    </div>
  );
}
