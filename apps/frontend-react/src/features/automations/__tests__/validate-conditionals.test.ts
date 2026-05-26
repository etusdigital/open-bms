import { describe, it, expect } from 'vitest';
import { validateAutomationConditionals } from '../editor/validate-conditionals';
import type { ApiStep } from '../editor/types';

const trigger = (child: ApiStep): ApiStep =>
  ({
    id: 1,
    type: 'trigger',
    settings: { type: 'tag', name: 'x' } as never,
    child: [child],
  }) as ApiStep;

const end: ApiStep = { id: 99, type: 'end', settings: {} as Record<string, never>, child: [] };

const conditional = (rules: unknown[]): ApiStep =>
  ({
    id: 2,
    type: 'conditional',
    settings: rules as never,
    child: [
      { id: 3, type: 'conditionalTrue', settings: rules as never, child: [end] },
      { id: 4, type: 'conditionalFalse', settings: {} as never, child: [end] },
    ],
  }) as ApiStep;

describe('validateAutomationConditionals', () => {
  it('returns empty array for a tree with no conditionals', () => {
    const tree = trigger(end);
    expect(validateAutomationConditionals(tree)).toEqual([]);
  });

  it('returns empty array for a conditional with a valid interaction rule (time=0 counts as set)', () => {
    const tree = trigger(
      conditional([
        {
          type: 'interation',
          event_type: 'email',
          conditional_interation: 'yes',
          event: 'last_open_date',
          time: 0,
        },
      ]),
    );
    expect(validateAutomationConditionals(tree)).toEqual([]);
  });

  it('flags missing_period when an interaction rule omits time', () => {
    const tree = trigger(
      conditional([
        {
          type: 'interation',
          event_type: 'email',
          conditional_interation: 'yes',
          event: 'last_open_date',
          // no time
        },
      ]),
    );
    const errors = validateAutomationConditionals(tree);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('missing_period');
    expect(errors[0].stepId).toBe(2);
  });

  it('flags empty_card when a conditional has no rules', () => {
    const tree = trigger(conditional([]));
    const errors = validateAutomationConditionals(tree);
    expect(errors.some((e) => e.type === 'empty_card')).toBe(true);
    expect(errors.some((e) => e.stepId === 2)).toBe(true);
  });

  it('walks nested conditionals (conditional inside conditionalTrue)', () => {
    const innerBadConditional = conditional([{ type: 'interation', event_type: 'email' }]); // missing time
    innerBadConditional.id = 5;
    (innerBadConditional.child[0] as ApiStep).id = 6;

    const outerConditional: ApiStep = {
      id: 2,
      type: 'conditional',
      settings: [
        { type: 'tag', conditional_tag: 'in', tag_id: [1], tag_info: [{ id: 1, name: 't', type: 'tag' }] },
      ] as never,
      child: [
        { id: 3, type: 'conditionalTrue', settings: [] as never, child: [innerBadConditional] },
        { id: 4, type: 'conditionalFalse', settings: {} as never, child: [end] },
      ],
    } as ApiStep;

    const tree = trigger(outerConditional);
    const errors = validateAutomationConditionals(tree);
    expect(errors.some((e) => e.type === 'missing_period' && e.stepId === 5)).toBe(true);
  });
});
