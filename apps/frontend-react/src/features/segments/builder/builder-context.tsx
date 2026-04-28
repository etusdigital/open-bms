import { createContext, use, useReducer, useMemo, type ReactNode } from 'react';
import { builderReducer, createInitialState } from './builder-reducer';
import type { BuilderState, BuilderCard, StepType, UpdateStepAction } from './types';

// ─── Context Types ───────────────────────────────────────────────────────────

interface BuilderActions {
  addCard: () => void;
  removeCard: (cardId: string) => void;
  duplicateCard: (cardId: string) => void;
  setCardConnector: (cardId: string, value: 'UNION' | 'INTERSECT') => void;
  addStep: (cardId: string, stepType: StepType) => void;
  removeStep: (cardId: string, stepId: string) => void;
  updateStep: (cardId: string, stepId: string, stepType: StepType, data: Record<string, unknown>) => void;
  setStepConnector: (cardId: string, stepId: string, value: 'and' | 'or') => void;
}

interface BuilderMeta {
  isDisabled: boolean;
  context: 'segment' | 'trigger';
  availableStepTypes: (card: BuilderCard) => StepType[];
}

interface _BuilderContextValue {
  state: BuilderState;
  actions: BuilderActions;
  meta: BuilderMeta;
}

// ─── Contexts (split for performance) ────────────────────────────────────────

const BuilderStateContext = createContext<BuilderState | null>(null);
const BuilderActionsContext = createContext<BuilderActions | null>(null);
const BuilderMetaContext = createContext<BuilderMeta | null>(null);

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useBuilderState(): BuilderState {
  const ctx = use(BuilderStateContext);
  if (!ctx) throw new Error('useBuilderState must be used within a BuilderProvider');
  return ctx;
}

export function useBuilderActions(): BuilderActions {
  const ctx = use(BuilderActionsContext);
  if (!ctx) throw new Error('useBuilderActions must be used within a BuilderProvider');
  return ctx;
}

export function useBuilderMeta(): BuilderMeta {
  const ctx = use(BuilderMetaContext);
  if (!ctx) throw new Error('useBuilderMeta must be used within a BuilderProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const ALL_STEP_TYPES: StepType[] = [
  'interation',
  'custom_field',
  'user_field',
  'tag',
  'automation_state',
  'custom_event',
];

interface BuilderProviderProps {
  initialCards: BuilderCard[];
  isDisabled?: boolean;
  context?: 'segment' | 'trigger';
  children: ReactNode;
  onStateChange?: (state: BuilderState) => void;
  /** Override available step types (defaults to ALL_STEP_TYPES) */
  stepTypes?: StepType[];
}

export function BuilderProvider({
  initialCards,
  isDisabled = false,
  context = 'segment',
  children,
  onStateChange,
  stepTypes,
}: BuilderProviderProps) {
  const [state, dispatch] = useReducer(builderReducer, initialCards, (cards) => createInitialState(cards));

  // Notify parent of state changes (for serialization on submit)
  if (onStateChange) {
    onStateChange(state);
  }

  const actions: BuilderActions = useMemo(
    () => ({
      addCard: () => dispatch({ type: 'ADD_CARD' }),
      removeCard: (cardId: string) => dispatch({ type: 'REMOVE_CARD', cardId }),
      duplicateCard: (cardId: string) => dispatch({ type: 'DUPLICATE_CARD', cardId }),
      setCardConnector: (cardId: string, value: 'UNION' | 'INTERSECT') =>
        dispatch({ type: 'SET_CARD_CONNECTOR', cardId, value }),
      addStep: (cardId: string, stepType: StepType) => dispatch({ type: 'ADD_STEP', cardId, stepType }),
      removeStep: (cardId: string, stepId: string) => dispatch({ type: 'REMOVE_STEP', cardId, stepId }),
      updateStep: (cardId: string, stepId: string, stepType: StepType, data: Record<string, unknown>) =>
        dispatch({ type: 'UPDATE_STEP', cardId, stepId, stepType, data } as UpdateStepAction),
      setStepConnector: (cardId: string, stepId: string, value: 'and' | 'or') =>
        dispatch({ type: 'SET_STEP_CONNECTOR', cardId, stepId, value }),
    }),
    [],
  );

  const types = stepTypes ?? ALL_STEP_TYPES;
  const meta: BuilderMeta = useMemo(
    () => ({
      isDisabled,
      context,
      availableStepTypes: (card: BuilderCard): StepType[] => {
        const hasTag = card.steps.some((s) => s.type === 'tag');
        return hasTag ? types.filter((t) => t !== 'tag') : types;
      },
    }),
    [isDisabled, types, context],
  );

  return (
    <BuilderStateContext value={state}>
      <BuilderActionsContext value={actions}>
        <BuilderMetaContext value={meta}>{children}</BuilderMetaContext>
      </BuilderActionsContext>
    </BuilderStateContext>
  );
}
