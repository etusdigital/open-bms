import type { BuilderState, StepData } from './types';

export interface BuilderError {
  type: 'missing_period' | 'empty_card';
  cardIndex: number;
  stepIndex?: number;
  message: string;
}

/** Step types that require a time/period value to be set */
const TIMED_STEP_TYPES = new Set(['interation', 'automation_state', 'custom_event']);

/**
 * Validates the builder state before form submission.
 * Returns an array of errors. Empty array means valid.
 */
export function validateBuilder(state: BuilderState): BuilderError[] {
  const errors: BuilderError[] = [];

  for (let cardIndex = 0; cardIndex < state.cards.length; cardIndex++) {
    const card = state.cards[cardIndex];

    // Check for empty cards
    if (card.steps.length === 0) {
      errors.push({
        type: 'empty_card',
        cardIndex,
        message: `Condition group ${cardIndex + 1} has no conditions`,
      });
      continue;
    }

    // Check timed steps have period set
    for (let stepIndex = 0; stepIndex < card.steps.length; stepIndex++) {
      const step = card.steps[stepIndex];
      if (TIMED_STEP_TYPES.has(step.type) && !hasValidPeriod(step)) {
        errors.push({
          type: 'missing_period',
          cardIndex,
          stepIndex,
          message: `Missing period in condition group ${cardIndex + 1}, condition ${stepIndex + 1}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Checks if a timed step has a valid period set.
 * time: 0 (today) is VALID — we check for null/undefined/empty-string explicitly.
 */
function hasValidPeriod(step: StepData): boolean {
  if (!('time' in step)) return true;
  const time = (step as { time?: unknown }).time;
  return time !== null && time !== undefined && time !== '';
}
