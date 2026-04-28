import type { Draft } from 'immer';
import { produce } from 'immer';
import type { BuilderState, BuilderAction, BuilderCard, StepData, InteractionStepData } from './types';
import { createDefaultStep } from './types';

export function createInitialState(cards?: BuilderCard[]): BuilderState {
  return { cards: cards ?? [] };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'ADD_CARD':
        handleAddCard(draft);
        break;
      case 'REMOVE_CARD':
        handleRemoveCard(draft, action.cardId);
        break;
      case 'DUPLICATE_CARD':
        handleDuplicateCard(draft, action.cardId);
        break;
      case 'SET_CARD_CONNECTOR':
        handleSetCardConnector(draft, action.cardId, action.value);
        break;
      case 'ADD_STEP':
        handleAddStep(draft, action.cardId, action.stepType);
        break;
      case 'REMOVE_STEP':
        handleRemoveStep(draft, action.cardId, action.stepId);
        break;
      case 'UPDATE_STEP':
        handleUpdateStep(draft, action.cardId, action.stepId, action.stepType, action.data);
        break;
      case 'SET_STEP_CONNECTOR':
        handleSetStepConnector(draft, action.cardId, action.stepId, action.value);
        break;
      case 'LOAD_STATE':
        draft.cards = action.cards;
        break;
    }
  });
}

function handleAddCard(draft: Draft<BuilderState>) {
  const newCard: BuilderCard = {
    id: crypto.randomUUID(),
    steps: [],
    cardConnector: draft.cards.length > 0 ? 'INTERSECT' : undefined,
  };
  draft.cards.push(newCard);
}

function handleRemoveCard(draft: Draft<BuilderState>, cardId: string) {
  const index = draft.cards.findIndex((c) => c.id === cardId);
  if (index === -1) return;

  draft.cards.splice(index, 1);

  // Strip cardConnector from new first card
  if (index === 0 && draft.cards.length > 0) {
    draft.cards[0].cardConnector = undefined;
  }
}

function handleDuplicateCard(draft: Draft<BuilderState>, cardId: string) {
  const index = draft.cards.findIndex((c) => c.id === cardId);
  if (index === -1) return;

  const source = draft.cards[index];
  const clone: BuilderCard = {
    id: crypto.randomUUID(),
    cardConnector: 'UNION',
    steps: source.steps.map((step) => ({
      ...step,
      id: crypto.randomUUID(),
    })) as StepData[],
  };

  draft.cards.splice(index + 1, 0, clone);
}

function handleSetCardConnector(draft: Draft<BuilderState>, cardId: string, value: 'UNION' | 'INTERSECT') {
  const card = draft.cards.find((c) => c.id === cardId);
  if (card) card.cardConnector = value;
}

function handleAddStep(draft: Draft<BuilderState>, cardId: string, stepType: string) {
  const card = draft.cards.find((c) => c.id === cardId);
  if (!card) return;

  // Tag constraint: only one tag step per card
  if (stepType === 'tag' && card.steps.some((s) => s.type === 'tag')) {
    return;
  }

  const newStep = createDefaultStep(stepType as Parameters<typeof createDefaultStep>[0]);

  // Set stepConnector on non-first steps
  if (card.steps.length > 0) {
    newStep.stepConnector = 'and';
  }

  card.steps.push(newStep);
}

function handleRemoveStep(draft: Draft<BuilderState>, cardId: string, stepId: string) {
  const card = draft.cards.find((c) => c.id === cardId);
  if (!card) return;

  const index = card.steps.findIndex((s) => s.id === stepId);
  if (index === -1) return;

  card.steps.splice(index, 1);

  // Strip stepConnector from new first step
  if (index === 0 && card.steps.length > 0) {
    card.steps[0].stepConnector = undefined;
  }
}

function handleUpdateStep(
  draft: Draft<BuilderState>,
  cardId: string,
  stepId: string,
  stepType: string,
  data: Record<string, unknown>,
) {
  const card = draft.cards.find((c) => c.id === cardId);
  if (!card) return;

  const step = card.steps.find((s) => s.id === stepId);
  if (!step) return;

  // Cascading resets for interaction channel type change
  if (stepType === 'interation' && 'event_type' in data) {
    const interactionStep = step as Draft<InteractionStepData>;
    if (interactionStep.event_type !== data.event_type) {
      interactionStep.event = undefined;
      interactionStep.message = null;
      interactionStep.conditional_times_value = undefined;
      interactionStep.custom_times_value = 1;
      interactionStep.page_view_filter = null;
      interactionStep.page_view_value = null;
    }
  }

  // Apply the update
  Object.assign(step, data);
}

function handleSetStepConnector(draft: Draft<BuilderState>, cardId: string, stepId: string, value: 'and' | 'or') {
  const card = draft.cards.find((c) => c.id === cardId);
  if (!card) return;

  const step = card.steps.find((s) => s.id === stepId);
  if (step) step.stepConnector = value;
}
