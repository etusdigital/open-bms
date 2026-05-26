import type { ApiStep, ConditionalRule } from './types';
import { parseSteps } from '@/features/segments/builder/builder-serializer';
import { validateBuilder, type BuilderError } from '@/features/segments/builder/builder-validator';

export interface ConditionalValidationError {
  type: BuilderError['type'];
  stepId: number | string;
  cardIndex: number;
  stepIndex?: number;
  message: string;
}

/**
 * Walks an automation tree and runs the segment-builder validator against every
 * `conditional` node's rules. Mirrors what the backend AJV schema enforces
 * (obj_conditional with minItems:1 + obj_conditional_interaction requiring `time`),
 * but lets us catch the failure client-side with a better error reference (the
 * step id) before the POST round-trip collapses everything into the generic
 * `error_conditional` message.
 */
export function validateAutomationConditionals(root: ApiStep): ConditionalValidationError[] {
  const errors: ConditionalValidationError[] = [];

  function walk(step: ApiStep) {
    if (step.type === 'conditional') {
      const rules = (step.settings as ConditionalRule[] | undefined) ?? [];
      const cards = parseSteps([rules as unknown[]]);
      const state = { cards };
      const builderErrors = validateBuilder(state);
      for (const e of builderErrors) {
        errors.push({
          type: e.type,
          stepId: step.id,
          cardIndex: e.cardIndex,
          stepIndex: e.stepIndex,
          message: e.message,
        });
      }
    }

    for (const child of step.child ?? []) {
      walk(child);
    }
  }

  walk(root);
  return errors;
}
