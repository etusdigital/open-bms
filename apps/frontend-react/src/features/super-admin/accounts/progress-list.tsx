import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import type { ImportProgressEntry, ImportStatus } from './import-gateway';

// Mantido em sincronia com o pipeline do worker (apps/enterprise-import
// pipeline.ts). instance-config, account-settings e users foram removidos do
// import (config manual / dados account-scoped) — não aparecem mais aqui.
// A chave da entidade no progresso → chave i18n em superAdmin.accounts.import.entities.
const ENTITY_I18N: Record<string, string> = {
  tags: 'tags',
  'custom-fields': 'customFields',
  labels: 'labels',
  'email-templates': 'emailTemplates',
  contacts: 'contacts',
  'custom-events': 'customEvents',
  automations: 'automations',
  campaigns: 'campaigns',
  messages: 'messages',
};

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
  // Job concluído ⇒ todo step que rodou está 100%. Vários importers
  // (ex.: messages) emitem só {done, page} sem {total} — sem isso o
  // pct() não tem como calcular e a barra ficaria travada em 0% mesmo com o
  // job `completed`. Quando o job conclui, forçamos 100% (o que processou
  // também fica cheio, batendo com o status).
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
