import { Progress } from '@/components/ui/progress';
import type { ImportProgressEntry } from './import-gateway';

const ENTITY_LABELS: Record<string, string> = {
  'instance-config': 'Configs globais (instance)',
  'account-settings': 'Account settings (providers)',
  tags: 'Tags',
  'custom-fields': 'Custom fields',
  labels: 'Labels',
  users: 'Users',
  'email-templates': 'Email templates',
  contacts: 'Contacts',
  'custom-events': 'Custom events',
  automations: 'Automations',
  campaigns: 'Campaigns',
  messages: 'Messages',
  statistics: 'Statistics',
};

function entityLabel(key: string): string {
  return ENTITY_LABELS[key] ?? key;
}

function pct(entry: ImportProgressEntry): number {
  if (!entry.total || entry.total === 0) return 0;
  const done = entry.done ?? 0;
  return Math.min(100, Math.round((done / entry.total) * 100));
}

export function ProgressList({ progress }: { progress: Record<string, ImportProgressEntry> }) {
  const keys = Object.keys(ENTITY_LABELS);
  return (
    <div className="space-y-3">
      {keys.map((k) => {
        const entry = progress[k];
        const skipped = entry?.skipped;
        const value = entry ? pct(entry) : 0;
        return (
          <div key={k} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span>{entityLabel(k)}</span>
              <span className="text-muted-foreground text-xs">
                {skipped
                  ? `pulado (${entry?.reason ?? 'n/a'})`
                  : entry
                    ? `${entry.done ?? 0}${entry.total ? `/${entry.total}` : ''} (page ${entry.page ?? '-'})`
                    : 'pendente'}
              </span>
            </div>
            <Progress value={skipped ? 100 : value} />
          </div>
        );
      })}
    </div>
  );
}
