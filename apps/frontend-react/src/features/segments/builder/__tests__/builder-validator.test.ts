// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { validateBuilder } from '../builder-validator';
import type {
  BuilderState,
  BuilderCard,
  InteractionStepData,
  AutomationStateStepData,
  TagStepData,
} from '../types';

function makeState(...cards: BuilderCard[]): BuilderState {
  return { cards };
}

function makeCard(id: string, ...steps: BuilderState['cards'][0]['steps']): BuilderCard {
  return { id, steps: steps.flat() };
}

function makeInteraction(overrides: Partial<InteractionStepData> = {}): InteractionStepData {
  return {
    id: crypto.randomUUID(),
    type: 'interation',
    event_type: 'email',
    time: 7,
    ...overrides,
  };
}

function makeAutomation(overrides: Partial<AutomationStateStepData> = {}): AutomationStateStepData {
  return {
    id: crypto.randomUUID(),
    type: 'automation_state',
    event: 'entered',
    time: 7,
    ...overrides,
  };
}

function makeTag(overrides: Partial<TagStepData> = {}): TagStepData {
  return { id: crypto.randomUUID(), type: 'tag', conditional_tag: 'in', tag_id: [1], ...overrides };
}

describe('validateBuilder', () => {
  it('returns no errors for valid state', () => {
    const state = makeState(makeCard('c1', [makeInteraction({ time: 7 }), makeTag()]));
    const errors = validateBuilder(state);
    expect(errors).toEqual([]);
  });

  it('returns no errors for empty state', () => {
    const errors = validateBuilder({ cards: [] });
    expect(errors).toEqual([]);
  });

  it('detects missing period on interaction step', () => {
    const state = makeState(makeCard('c1', [makeInteraction({ time: null })]));
    const errors = validateBuilder(state);
    expect(errors).toHaveLength(1);
    expect(errors[0].cardIndex).toBe(0);
    expect(errors[0].stepIndex).toBe(0);
  });

  it('detects missing period on automation_state step', () => {
    const state = makeState(makeCard('c1', [makeAutomation({ time: null })]));
    const errors = validateBuilder(state);
    expect(errors).toHaveLength(1);
  });

  it('treats time: 0 (today) as VALID', () => {
    const state = makeState(makeCard('c1', [makeInteraction({ time: 0 })]));
    const errors = validateBuilder(state);
    expect(errors).toEqual([]);
  });

  it('treats time: "all" as VALID', () => {
    const state = makeState(makeCard('c1', [makeInteraction({ time: 'all' })]));
    const errors = validateBuilder(state);
    expect(errors).toEqual([]);
  });

  it('treats time: undefined as missing', () => {
    const state = makeState(makeCard('c1', [makeInteraction({ time: undefined })]));
    const errors = validateBuilder(state);
    expect(errors).toHaveLength(1);
  });

  it('treats time: "" (empty string) as missing', () => {
    const state = makeState(makeCard('c1', [makeInteraction({ time: '' as unknown as number })]));
    const errors = validateBuilder(state);
    expect(errors).toHaveLength(1);
  });

  it('does not validate period for tag or user_field steps', () => {
    const state = makeState(makeCard('c1', [makeTag(), { id: 'uf1', type: 'user_field' }]));
    const errors = validateBuilder(state);
    expect(errors).toEqual([]);
  });

  it('detects empty cards', () => {
    const state = makeState(
      makeCard('c1', []), // empty card
      makeCard('c2', [makeInteraction({ time: 7 })]),
    );
    const errors = validateBuilder(state);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('empty_card');
    expect(errors[0].cardIndex).toBe(0);
  });

  it('reports multiple errors across cards', () => {
    const state = makeState(
      makeCard('c1', [makeInteraction({ time: null })]),
      makeCard('c2', [makeAutomation({ time: null })]),
    );
    const errors = validateBuilder(state);
    expect(errors).toHaveLength(2);
  });
});
