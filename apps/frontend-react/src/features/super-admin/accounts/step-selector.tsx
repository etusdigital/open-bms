import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PIPELINE_STEPS, ENTITY_I18N } from './import-progress';
import { requiredParents } from './step-selection';

// Checkbox list of pipeline steps. Selecting a child auto-checks AND locks its
// required parents (they render checked + disabled), so a partial selection can
// never produce an orphaned/inconsistent import.
export function StepSelector({ value, onChange, disabled }: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const explicit = new Set(value);
  const locked = requiredParents(explicit);

  const toggle = (step: string, checked: boolean) => {
    const next = new Set(explicit);
    if (checked) next.add(step);
    else next.delete(step);
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      {PIPELINE_STEPS.map((step) => {
        const isLocked = locked.has(step);
        const checked = explicit.has(step) || isLocked;
        return (
          <div key={step} className="flex items-center gap-2">
            <Checkbox id={`step-${step}`} checked={checked} disabled={disabled || isLocked} onCheckedChange={(v) => toggle(step, v === true)} />
            <Label htmlFor={`step-${step}`} className="cursor-pointer text-sm font-normal">
              {t(`superAdmin.accounts.import.entities.${ENTITY_I18N[step] ?? step}`)}
              {isLocked && !explicit.has(step) && (
                <span className="text-muted-foreground ml-1 text-xs">({t('superAdmin.accounts.import.selective.required')})</span>
              )}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
