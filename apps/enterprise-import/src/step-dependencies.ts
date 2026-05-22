// Selective-import dependency rules. A child step needs its parents present in
// the SAME job so its FKs resolve via the idMapper (which is keyed by jobId and
// re-maps source ids to existing OSS rows by natural key). Selecting a child
// therefore forces its parents to (re)run — even if only to repopulate the
// id map against already-imported rows.
//
// Keys/values are importer `name`s; keep in sync with pipeline.ts.
export const STEP_DEPENDENCIES: Record<string, string[]> = {
  contact_tags: ['contacts', 'tags'],
  contact_custom_fields: ['contacts', 'custom-fields'],
  messages: ['campaigns'],
};

// Expands a user-selected set to include every required parent (transitively).
// Returns null when `selected` is null/empty → "run everything" (full import).
export function expandSelectedSteps(selected?: string[] | null): Set<string> | null {
  if (!selected || selected.length === 0) return null;
  const out = new Set<string>();
  const add = (step: string): void => {
    if (out.has(step)) return;
    out.add(step);
    for (const parent of STEP_DEPENDENCIES[step] ?? []) add(parent);
  };
  for (const step of selected) add(step);
  return out;
}
