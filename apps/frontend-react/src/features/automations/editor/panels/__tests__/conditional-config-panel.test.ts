import { describe, it, expect } from 'vitest';
import { cardsToRules, rulesToCards } from '../conditional-config-panel';
import type { ConditionalRule } from '../../types';

describe('conditional-config-panel cardsToRules / rulesToCards', () => {
  it('strips conditional_times_value on save (segments-only field rejected by automation schema)', () => {
    const cards = [
      {
        id: 'card-1',
        steps: [
          {
            id: 'step-1',
            type: 'interation',
            event_type: 'email',
            event: 'last_open_date',
            conditional_interation: 'yes',
            time: 0,
            custom_times_value: 1,
            conditional_times_value: '>=',
          },
        ],
      },
    ];

    const rules = cardsToRules(cards as never) as Array<Record<string, unknown>>;
    expect(rules[0]).not.toHaveProperty('conditional_times_value');
    expect(rules[0].custom_times_value).toBe(1);
  });

  // Regression: a saved conditional reopened in the panel reloads via parseSteps,
  // then ADD_STEP / createDefaultStep re-injects `conditional_times_value: '>='`
  // for any new interaction step. The strip must hold across the reopen→save
  // cycle so we never accidentally re-send the segments-only field.
  it('strip survives a save → load → save roundtrip', () => {
    const initialRules: ConditionalRule[] = [
      {
        type: 'interation',
        event_type: 'email',
        event: 'last_open_date',
        conditional_interation: 'yes',
        time: 0,
        custom_times_value: 1,
      } as unknown as ConditionalRule,
    ];

    // Load into the panel (parseSteps path)
    const cards = rulesToCards(initialRules);
    expect(cards.length).toBeGreaterThan(0);

    // Save back out
    const savedRules = cardsToRules(cards) as Array<Record<string, unknown>>;
    expect(savedRules[0]).not.toHaveProperty('conditional_times_value');

    // Reopen with the saved rules → save again
    const cardsRoundtrip = rulesToCards(savedRules as ConditionalRule[]);
    const savedAgain = cardsToRules(cardsRoundtrip) as Array<Record<string, unknown>>;
    expect(savedAgain[0]).not.toHaveProperty('conditional_times_value');
  });
});
