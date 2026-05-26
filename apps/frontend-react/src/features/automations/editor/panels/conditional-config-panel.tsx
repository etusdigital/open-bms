import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BuilderProvider } from '@/features/segments/builder/builder-context';
import { AutomationConditionBuilder } from './automation-condition-builder';
import { parseSteps, serializeSteps } from '@/features/segments/builder/builder-serializer';
import type { BuilderState, BuilderCard, StepType } from '@/features/segments/builder/types';
import type { ConditionalNodeData, ConditionalRule } from '../types';

/** Step types available in the automation conditional builder (includes 'lead') */
const AUTOMATION_STEP_TYPES: StepType[] = [
  'interation',
  'custom_field',
  'user_field',
  'tag',
  'automation_state',
  'lead',
];

interface ConditionalConfigProps {
  data: ConditionalNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}

export function rulesToCards(rules: ConditionalRule[]): BuilderCard[] {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return [{ id: crypto.randomUUID(), steps: [] }];
  }
  return parseSteps([rules]);
}

// Fields the segments builder emits that the automation backend schema
// (obj_conditional_interaction / obj_conditional_automation_entry) does not
// accept under additionalProperties:false. Stripping at this boundary is
// the right place: it preserves the field for the segments query builder
// (which uses it to write `HAVING COUNT(...) >= N` against ClickHouse) while
// keeping the automation conditional payload schema-clean (EVO-1452).
const AUTOMATION_CONDITIONAL_DROP_FIELDS = ['conditional_times_value'] as const;

export function cardsToRules(cards: BuilderCard[]): ConditionalRule[] {
  const serialized = serializeSteps(cards);
  if (serialized.length === 0) return [];
  return (serialized[0] as Record<string, unknown>[]).map((rule) => {
    const cleaned: Record<string, unknown> = { ...rule };
    for (const field of AUTOMATION_CONDITIONAL_DROP_FIELDS) {
      delete cleaned[field];
    }
    return cleaned;
  }) as ConditionalRule[];
}

export function ConditionalConfigPanel({ data, onSave, onClose }: ConditionalConfigProps) {
  const { t } = useTranslation();

  const initialCards = useMemo(
    () => rulesToCards(data.settings as ConditionalRule[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // onSave ref to avoid stale closures in the rAF callback
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const rafRef = useRef<number>(0);
  const pendingRef = useRef<BuilderState | null>(null);

  // BuilderProvider calls onStateChange during render.
  // We MUST NOT call any setState here — only store in a ref and
  // schedule a rAF to flush after the render frame completes.
  const handleStateChange = useCallback((state: BuilderState) => {
    pendingRef.current = state;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!pendingRef.current) return;
      const rules = cardsToRules(pendingRef.current.cards);
      onSaveRef.current(rules as any);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <BuilderProvider initialCards={initialCards} onStateChange={handleStateChange} stepTypes={AUTOMATION_STEP_TYPES}>
        <AutomationConditionBuilder />
      </BuilderProvider>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}
