import { PIPELINE_STEPS } from './import-progress';

// Mirror of the worker's STEP_DEPENDENCIES (apps/enterprise-import/step-dependencies.ts).
// A child step needs its parents in the same job so FKs resolve.
export const STEP_DEPENDENCIES: Record<string, string[]> = {
  contact_tags: ['contacts', 'tags'],
  contact_custom_fields: ['contacts', 'custom-fields'],
  messages: ['campaigns'],
};

// Parents that must be locked-on because some explicitly-selected child needs
// them (transitive). These render checked + disabled in the UI.
export function requiredParents(selected: Iterable<string>): Set<string> {
  const locked = new Set<string>();
  const addParents = (step: string): void => {
    for (const p of STEP_DEPENDENCIES[step] ?? []) {
      if (!locked.has(p)) {
        locked.add(p);
        addParents(p);
      }
    }
  };
  for (const s of selected) addParents(s);
  return locked;
}

// Effective set the backend should run = explicit picks ∪ required parents,
// returned in pipeline order.
export function effectiveSteps(selected: Iterable<string>): string[] {
  const out = new Set<string>(selected);
  for (const p of requiredParents(selected)) out.add(p);
  return PIPELINE_STEPS.filter((s) => out.has(s));
}

// What to send as selectedSteps: undefined (= full import) when nothing is
// chosen or everything is chosen; otherwise the effective subset.
export function selectedStepsPayload(selected: Iterable<string>): string[] | undefined {
  const eff = effectiveSteps(selected);
  if (eff.length === 0 || eff.length === PIPELINE_STEPS.length) return undefined;
  return eff;
}
