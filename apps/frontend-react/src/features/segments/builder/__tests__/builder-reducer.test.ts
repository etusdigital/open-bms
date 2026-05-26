// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { builderReducer, createInitialState } from '../builder-reducer';
import type { BuilderState, BuilderAction, BuilderCard, InteractionStepData, TagStepData } from '../types';

function dispatch(state: BuilderState, action: BuilderAction): BuilderState {
  return builderReducer(state, action);
}

function stateWithCards(...cards: BuilderCard[]): BuilderState {
  return { cards };
}

function makeCard(overrides: Partial<BuilderCard> = {}): BuilderCard {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    steps: overrides.steps ?? [],
    cardConnector: overrides.cardConnector,
  };
}

function makeInteractionStep(overrides: Partial<InteractionStepData> = {}): InteractionStepData {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: 'interation',
    event_type: 'email',
    conditional_interation: 'yes',
    custom_times_value: 1,
    ...overrides,
  };
}

function makeTagStep(overrides: Partial<TagStepData> = {}): TagStepData {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: 'tag',
    conditional_tag: 'in',
    tag_id: [],
    tag_info: [],
    ...overrides,
  };
}

describe('builderReducer', () => {
  describe('createInitialState', () => {
    it('creates empty state', () => {
      const state = createInitialState();
      expect(state.cards).toEqual([]);
    });

    it('creates state from existing cards', () => {
      const cards = [makeCard()];
      const state = createInitialState(cards);
      expect(state.cards).toEqual(cards);
    });
  });

  describe('ADD_CARD', () => {
    it('adds a new empty card', () => {
      const state = createInitialState();
      const next = dispatch(state, { type: 'ADD_CARD' });
      expect(next.cards).toHaveLength(1);
      expect(next.cards[0].steps).toEqual([]);
      expect(next.cards[0].id).toBeTruthy();
    });

    it('sets cardConnector on subsequent cards', () => {
      const state = stateWithCards(makeCard());
      const next = dispatch(state, { type: 'ADD_CARD' });
      expect(next.cards).toHaveLength(2);
      expect(next.cards[0].cardConnector).toBeUndefined();
      expect(next.cards[1].cardConnector).toBe('INTERSECT');
    });
  });

  describe('REMOVE_CARD', () => {
    it('removes a card by id', () => {
      const card1 = makeCard({ id: 'card-1' });
      const card2 = makeCard({ id: 'card-2', cardConnector: 'UNION' });
      const state = stateWithCards(card1, card2);

      const next = dispatch(state, { type: 'REMOVE_CARD', cardId: 'card-2' });
      expect(next.cards).toHaveLength(1);
      expect(next.cards[0].id).toBe('card-1');
    });

    it('strips cardConnector from new first card', () => {
      const card1 = makeCard({ id: 'card-1' });
      const card2 = makeCard({ id: 'card-2', cardConnector: 'UNION' });
      const card3 = makeCard({ id: 'card-3', cardConnector: 'INTERSECT' });
      const state = stateWithCards(card1, card2, card3);

      const next = dispatch(state, { type: 'REMOVE_CARD', cardId: 'card-1' });
      expect(next.cards).toHaveLength(2);
      expect(next.cards[0].cardConnector).toBeUndefined();
      expect(next.cards[1].cardConnector).toBe('INTERSECT');
    });

    it('handles removing the last card', () => {
      const card = makeCard({ id: 'card-1' });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'REMOVE_CARD', cardId: 'card-1' });
      expect(next.cards).toHaveLength(0);
    });

    it('does nothing for unknown card id', () => {
      const card = makeCard({ id: 'card-1' });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'REMOVE_CARD', cardId: 'nonexistent' });
      expect(next.cards).toHaveLength(1);
    });
  });

  describe('DUPLICATE_CARD', () => {
    it('duplicates a card with new IDs', () => {
      const step = makeInteractionStep({ id: 'step-1' });
      const card = makeCard({ id: 'card-1', steps: [step] });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'DUPLICATE_CARD', cardId: 'card-1' });
      expect(next.cards).toHaveLength(2);
      // Clone is inserted after original
      expect(next.cards[0].id).toBe('card-1');
      expect(next.cards[1].id).not.toBe('card-1');
      // Clone has new step IDs
      expect(next.cards[1].steps).toHaveLength(1);
      expect(next.cards[1].steps[0].id).not.toBe('step-1');
      // Clone preserves step data
      expect(next.cards[1].steps[0].type).toBe('interation');
      expect((next.cards[1].steps[0] as InteractionStepData).event_type).toBe('email');
    });

    it('sets UNION connector on duplicated card', () => {
      const card = makeCard({ id: 'card-1' });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'DUPLICATE_CARD', cardId: 'card-1' });
      expect(next.cards[1].cardConnector).toBe('UNION');
    });

    it('duplicates the first card correctly', () => {
      const card1 = makeCard({ id: 'card-1' });
      const card2 = makeCard({ id: 'card-2', cardConnector: 'INTERSECT' });
      const state = stateWithCards(card1, card2);

      const next = dispatch(state, { type: 'DUPLICATE_CARD', cardId: 'card-1' });
      expect(next.cards).toHaveLength(3);
      expect(next.cards[0].cardConnector).toBeUndefined();
      expect(next.cards[1].cardConnector).toBe('UNION');
      expect(next.cards[2].cardConnector).toBe('INTERSECT');
    });
  });

  describe('SET_CARD_CONNECTOR', () => {
    it('changes the connector between cards', () => {
      const card1 = makeCard({ id: 'card-1' });
      const card2 = makeCard({ id: 'card-2', cardConnector: 'INTERSECT' });
      const state = stateWithCards(card1, card2);

      const next = dispatch(state, {
        type: 'SET_CARD_CONNECTOR',
        cardId: 'card-2',
        value: 'UNION',
      });
      expect(next.cards[1].cardConnector).toBe('UNION');
    });
  });

  describe('ADD_STEP', () => {
    it('adds a step to a card', () => {
      const card = makeCard({ id: 'card-1' });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'ADD_STEP', cardId: 'card-1', stepType: 'interation' });
      expect(next.cards[0].steps).toHaveLength(1);
      expect(next.cards[0].steps[0].type).toBe('interation');
      expect(next.cards[0].steps[0].id).toBeTruthy();
    });

    it.each(['interation', 'automation_state'] as const)(
      'seeds conditional_times_value to >= on a new %s step (EVO-1423)',
      (stepType) => {
        const card = makeCard({ id: 'card-1' });
        const state = stateWithCards(card);

        const next = dispatch(state, { type: 'ADD_STEP', cardId: 'card-1', stepType });
        expect((next.cards[0].steps[0] as { conditional_times_value?: string }).conditional_times_value).toBe('>=');
      },
    );

    it('initializes interaction step with time=0 so the backend schema accepts it without user touching the period select', () => {
      const card = makeCard({ id: 'card-1' });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'ADD_STEP', cardId: 'card-1', stepType: 'interation' });
      const step = next.cards[0].steps[0] as { type: string; time?: unknown };
      expect(step.type).toBe('interation');
      expect(step.time).toBe(0);
    });

    it('sets stepConnector on subsequent steps', () => {
      const step = makeInteractionStep({ id: 'step-1' });
      const card = makeCard({ id: 'card-1', steps: [step] });
      const state = stateWithCards(card);

      const next = dispatch(state, {
        type: 'ADD_STEP',
        cardId: 'card-1',
        stepType: 'custom_field',
      });
      expect(next.cards[0].steps).toHaveLength(2);
      expect(next.cards[0].steps[0].stepConnector).toBeUndefined();
      expect(next.cards[0].steps[1].stepConnector).toBe('and');
    });

    it('rejects duplicate tag step in same card', () => {
      const tagStep = makeTagStep({ id: 'tag-1' });
      const card = makeCard({ id: 'card-1', steps: [tagStep] });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'ADD_STEP', cardId: 'card-1', stepType: 'tag' });
      // Should not add a second tag step
      expect(next.cards[0].steps).toHaveLength(1);
    });

    it('allows tag step if no existing tag in card', () => {
      const step = makeInteractionStep();
      const card = makeCard({ id: 'card-1', steps: [step] });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'ADD_STEP', cardId: 'card-1', stepType: 'tag' });
      expect(next.cards[0].steps).toHaveLength(2);
      expect(next.cards[0].steps[1].type).toBe('tag');
    });
  });

  describe('REMOVE_STEP', () => {
    it('removes a step from a card', () => {
      const step1 = makeInteractionStep({ id: 'step-1' });
      const step2 = makeInteractionStep({ id: 'step-2', stepConnector: 'and' });
      const card = makeCard({ id: 'card-1', steps: [step1, step2] });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'REMOVE_STEP', cardId: 'card-1', stepId: 'step-2' });
      expect(next.cards[0].steps).toHaveLength(1);
      expect(next.cards[0].steps[0].id).toBe('step-1');
    });

    it('strips stepConnector from new first step', () => {
      const step1 = makeInteractionStep({ id: 'step-1' });
      const step2 = makeInteractionStep({ id: 'step-2', stepConnector: 'and' });
      const step3 = makeInteractionStep({ id: 'step-3', stepConnector: 'or' });
      const card = makeCard({ id: 'card-1', steps: [step1, step2, step3] });
      const state = stateWithCards(card);

      const next = dispatch(state, { type: 'REMOVE_STEP', cardId: 'card-1', stepId: 'step-1' });
      expect(next.cards[0].steps).toHaveLength(2);
      expect(next.cards[0].steps[0].stepConnector).toBeUndefined();
      expect(next.cards[0].steps[1].stepConnector).toBe('or');
    });
  });

  describe('UPDATE_STEP', () => {
    it('updates step fields', () => {
      const step = makeInteractionStep({ id: 'step-1', event_type: 'email' });
      const card = makeCard({ id: 'card-1', steps: [step] });
      const state = stateWithCards(card);

      const next = dispatch(state, {
        type: 'UPDATE_STEP',
        cardId: 'card-1',
        stepId: 'step-1',
        stepType: 'interation',
        data: { event_type: 'sms' },
      });
      expect((next.cards[0].steps[0] as InteractionStepData).event_type).toBe('sms');
    });

    it('cascade-resets dependent fields on channel type change', () => {
      const step = makeInteractionStep({
        id: 'step-1',
        event_type: 'email',
        event: 'open',
        message: { id: 1, name: 'Test' },
        conditional_times_value: '>=',
        custom_times_value: 5,
      });
      const card = makeCard({ id: 'card-1', steps: [step] });
      const state = stateWithCards(card);

      const next = dispatch(state, {
        type: 'UPDATE_STEP',
        cardId: 'card-1',
        stepId: 'step-1',
        stepType: 'interation',
        data: { event_type: 'sms' },
      });
      const updated = next.cards[0].steps[0] as InteractionStepData;
      expect(updated.event_type).toBe('sms');
      // Dependent fields should be reset
      expect(updated.event).toBeUndefined();
      expect(updated.message).toBeNull();
      expect(updated.conditional_times_value).toBeUndefined();
      expect(updated.custom_times_value).toBe(1);
    });

    it('does not cascade-reset when updating non-channel fields', () => {
      const step = makeInteractionStep({
        id: 'step-1',
        event_type: 'email',
        event: 'open',
        message: { id: 1, name: 'Test' },
      });
      const card = makeCard({ id: 'card-1', steps: [step] });
      const state = stateWithCards(card);

      const next = dispatch(state, {
        type: 'UPDATE_STEP',
        cardId: 'card-1',
        stepId: 'step-1',
        stepType: 'interation',
        data: { custom_times_value: 3 },
      });
      const updated = next.cards[0].steps[0] as InteractionStepData;
      expect(updated.event).toBe('open');
      expect(updated.message).toEqual({ id: 1, name: 'Test' });
      expect(updated.custom_times_value).toBe(3);
    });
  });

  describe('SET_STEP_CONNECTOR', () => {
    it('changes the connector between steps', () => {
      const step1 = makeInteractionStep({ id: 'step-1' });
      const step2 = makeInteractionStep({ id: 'step-2', stepConnector: 'and' });
      const card = makeCard({ id: 'card-1', steps: [step1, step2] });
      const state = stateWithCards(card);

      const next = dispatch(state, {
        type: 'SET_STEP_CONNECTOR',
        cardId: 'card-1',
        stepId: 'step-2',
        value: 'or',
      });
      expect(next.cards[0].steps[1].stepConnector).toBe('or');
    });
  });

  describe('LOAD_STATE', () => {
    it('replaces entire state', () => {
      const state = createInitialState();
      const cards = [makeCard({ id: 'new-card' })];

      const next = dispatch(state, { type: 'LOAD_STATE', cards });
      expect(next.cards).toEqual(cards);
    });
  });

  describe('structural sharing', () => {
    it('only mutates the affected card on step update', () => {
      const step1 = makeInteractionStep({ id: 'step-1' });
      const step2 = makeInteractionStep({ id: 'step-2' });
      const card1 = makeCard({ id: 'card-1', steps: [step1] });
      const card2 = makeCard({ id: 'card-2', steps: [step2], cardConnector: 'INTERSECT' });
      const state = stateWithCards(card1, card2);

      const next = dispatch(state, {
        type: 'UPDATE_STEP',
        cardId: 'card-1',
        stepId: 'step-1',
        stepType: 'interation',
        data: { event_type: 'sms' },
      });

      // Card 2 should be the exact same reference (structural sharing via Immer)
      expect(next.cards[1]).toBe(state.cards[1]);
      // Card 1 should be different
      expect(next.cards[0]).not.toBe(state.cards[0]);
    });
  });
});
