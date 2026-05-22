/* eslint-disable i18next/no-literal-string -- this module is a key/identifier table, not user-facing copy */
import type { ImportProgressEntry, ImportStatus } from './import-gateway';

// Maps a worker progress key → i18n subkey under superAdmin.accounts.import.entities.
// Insertion order matches the worker pipeline (apps/enterprise-import/pipeline.ts);
// keep both in sync.
export const ENTITY_I18N: Record<string, string> = {
  tags: 'tags',
  'custom-fields': 'customFields',
  labels: 'labels',
  'email-templates': 'emailTemplates',
  'custom-events': 'customEvents',
  contacts: 'contacts',
  contact_tags: 'contactTags',
  contact_custom_fields: 'contactCustomFields',
  automations: 'automations',
  campaigns: 'campaigns',
  messages: 'messages',
};

export const PIPELINE_STEPS = Object.keys(ENTITY_I18N);

// A step is finished when skipped, or its done count reached a known total.
// Steps that emit only {done, page} (no total) can't be judged mid-flight; they
// only count as finished once the job itself completes.
export function isStepFinished(e?: ImportProgressEntry): boolean {
  if (!e) return false;
  if (e.skipped) return true;
  if (e.total != null && e.total > 0) return (e.done ?? 0) >= e.total;
  return false;
}

// Coarse overall percentage: finished steps / total steps. Capped at 99 while
// running (only a `completed` job is 100%) so the bar never claims done early.
export function overallPercent(progress: Record<string, ImportProgressEntry>, status?: ImportStatus): number {
  if (status === 'completed') return 100;
  const finished = PIPELINE_STEPS.filter((k) => isStepFinished(progress[k])).length;
  return Math.min(99, Math.round((finished / PIPELINE_STEPS.length) * 100));
}

// The step currently being processed: the worker checkpoint entity is the best
// signal; otherwise fall back to the last step that has any progress recorded.
export function currentStepKey(
  progress: Record<string, ImportProgressEntry>,
  checkpoint?: { entity?: string },
): string | undefined {
  if (checkpoint?.entity && ENTITY_I18N[checkpoint.entity]) return checkpoint.entity;
  const seen = PIPELINE_STEPS.filter((k) => progress[k]);
  return seen[seen.length - 1];
}
