import type { ApiStep, ConditionalRule } from './types';
import type { BuilderError } from '@/features/segments/builder/builder-validator';

export interface ConditionalValidationError {
  type: BuilderError['type'];
  stepId: number | string;
  cardIndex: number;
  stepIndex?: number;
  message: string;
}

/** Step types that require a time/period value (mirrors TIMED_STEP_TYPES in builder-validator). */
const TIMED_STEP_TYPES = new Set(['interation', 'automation_state']);

function hasValidPeriod(rule: Record<string, unknown>): boolean {
  const time = rule.time;
  return time !== null && time !== undefined && time !== '';
}

/**
 * Walks an automation tree and validates every `conditional` node's rules
 * against the same invariants the backend AJV schema enforces (obj_conditional
 * with minItems:1 + obj_conditional_interaction requiring `time`).
 *
 * Operates directly on the wire-shape rules to avoid re-running the parse-time
 * normalizers (interaction action-key flip, tag_info reshape) that `parseSteps`
 * applies — the validator only cares about presence/shape, not editor-facing
 * field names, so a double-normalize is both unnecessary and risky.
 */
export function validateAutomationConditionals(root: ApiStep): ConditionalValidationError[] {
  const errors: ConditionalValidationError[] = [];

  function walk(step: ApiStep) {
    if (step.type === 'conditional') {
      const rules = (step.settings as ConditionalRule[] | undefined) ?? [];

      if (!Array.isArray(rules) || rules.length === 0) {
        errors.push({
          type: 'empty_card',
          stepId: step.id,
          cardIndex: 0,
          message: 'Conditional has no rules',
        });
      } else {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i] as Record<string, unknown> | null | undefined;
          if (!rule || typeof rule !== 'object') continue;
          const ruleType = rule.type as string | undefined;
          if (ruleType && TIMED_STEP_TYPES.has(ruleType) && !hasValidPeriod(rule)) {
            errors.push({
              type: 'missing_period',
              stepId: step.id,
              cardIndex: 0,
              stepIndex: i,
              message: `Missing period in rule ${i + 1}`,
            });
          }
        }
      }
    }

    for (const child of step.child ?? []) {
      walk(child);
    }
  }

  walk(root);
  return errors;
}
