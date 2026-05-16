import { Progress } from '@/components/ui/progress';
import type { ImportProgressEntry, ImportStatus } from './import-gateway';

// Mantido em sincronia com o pipeline do worker (apps/enterprise-import
// pipeline.ts). instance-config, account-settings e users foram removidos do
// import (config manual / dados account-scoped) — não aparecem mais aqui.
const ENTITY_LABELS: Record<string, string> = {
  tags: 'Tags',
  'custom-fields': 'Custom fields',
  labels: 'Labels',
  'email-templates': 'Email templates',
  contacts: 'Contacts',
  'custom-events': 'Custom events',
  automations: 'Automations',
  campaigns: 'Campaigns',
  messages: 'Messages',
};

function entityLabel(key: string): string {
  return ENTITY_LABELS[key] ?? key;
}

function pct(entry: ImportProgressEntry): number {
  if (!entry.total || entry.total === 0) return 0;
  const done = entry.done ?? 0;
  return Math.min(100, Math.round((done / entry.total) * 100));
}

export function ProgressList({ progress, jobStatus }: { progress: Record<string, ImportProgressEntry>; jobStatus?: ImportStatus }) {
  const keys = Object.keys(ENTITY_LABELS);
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
          ? `pulado (${entry?.reason ?? 'n/a'})`
          : hasCounts
            ? `${entry!.done ?? 0}${entry!.total ? `/${entry!.total}` : ''}${entry!.page ? ` (page ${entry!.page})` : ''}`
            : jobDone
              ? 'concluído'
              : 'pendente';
        return (
          <div key={k} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span>{entityLabel(k)}</span>
              <span className="text-muted-foreground text-xs">{text}</span>
            </div>
            <Progress value={value} />
          </div>
        );
      })}
    </div>
  );
}
