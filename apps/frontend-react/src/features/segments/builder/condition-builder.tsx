import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderState, useBuilderActions, useBuilderMeta } from './builder-context';
import { ConditionCard } from './condition-card';
import { LogicConnector } from './logic-connector';
import { UnsupportedStep } from './unsupported-step';
import { InteractionStep } from './interaction-step';
import { CustomFieldStep } from './custom-field-step';
import { UserFieldStep } from './user-field-step';
import { TagStep } from './tag-step';
import { AutomationStateStep } from './automation-state-step';
import type { StepData, UnsupportedStepData } from './types';

// ─── Step Renderer (registry pattern) ────────────────────────────────────────

interface StepComponentProps {
  data: StepData;
  cardId: string;
  stepIndex: number;
}

const STEP_COMPONENTS: Record<string, React.ComponentType<{ data: any; cardId: string }>> = {
  interation: InteractionStep,
  custom_field: CustomFieldStep,
  user_field: UserFieldStep,
  tag: TagStep,
  automation_state: AutomationStateStep,
};

function StepRenderer({ data, cardId, stepIndex: _stepIndex }: StepComponentProps) {
  if (data.type === 'unknown') {
    return <UnsupportedStep data={data as UnsupportedStepData} />;
  }

  const Component = STEP_COMPONENTS[data.type];
  if (Component) {
    return <Component data={data} cardId={cardId} />;
  }

  // Fallback for truly unknown types that somehow bypassed the serializer
  return (
    <div className="bg-secondary/30 text-muted-foreground rounded-lg p-3 text-xs">
      <span>
        Tipo: <code className="font-mono">{data.type}</code>
      </span>
    </div>
  );
}

// ─── Step Row (with connector + delete) ──────────────────────────────────────

const StepRow = memo(function StepRow({
  data,
  cardId,
  stepIndex,
}: {
  data: StepData;
  cardId: string;
  stepIndex: number;
}) {
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  return (
    <div className="group flex items-start">
      <div className="flex-1">
        <StepRenderer data={data} cardId={cardId} stepIndex={stepIndex} />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive mt-2 ml-1 h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        disabled={meta.isDisabled}
        onClick={() => actions.removeStep(cardId, data.id)}
        aria-label="Remove condition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});

// ─── Steps with vertical track + horizontal branches ─────────────────────────

/**
 * Renders steps within a card with a continuous vertical line on the left.
 * Both step rows AND connector pills get horizontal branches from the track.
 *
 * Layout:
 *   |── [step content........]
 *   |
 *   |── [E ▾]
 *   |
 *   |── [step content........]
 */
function StepsWithTrack({
  card,
  cardId,
  actions,
  meta,
}: {
  card: { steps: StepData[] };
  cardId: string;
  actions: ReturnType<typeof useBuilderActions>;
  meta: ReturnType<typeof useBuilderMeta>;
}) {
  return (
    <div>
      {card.steps.map((step, stepIndex) => (
        <div key={step.id}>
          {/* Connector row: vertical segment + horizontal branch + pill */}
          {stepIndex > 0 && step.stepConnector && (
            <div className="flex items-stretch">
              {/* Vertical line segment + horizontal branch to pill */}
              <div className="relative flex items-center" style={{ width: '2rem' }}>
                {/* Vertical line (full height of this row) */}
                <div className="bg-border absolute top-0 bottom-0 left-3 w-px" />
                {/* Horizontal branch to the pill */}
                <div className="bg-border absolute top-1/2 left-3 h-px w-5" />
              </div>
              <div className="py-2">
                <LogicConnector
                  variant="step"
                  value={step.stepConnector}
                  onChange={(value) => actions.setStepConnector(cardId, step.id, value as 'and' | 'or')}
                  disabled={meta.isDisabled}
                />
              </div>
            </div>
          )}

          {/* Step row: vertical segment + horizontal branch + step content */}
          <div className="flex items-stretch">
            {/* Vertical line segment + horizontal branch to step */}
            <div className="relative flex items-center" style={{ width: '2rem' }}>
              {/* Vertical line — full height, except cut short at top of first and bottom of last */}
              <div
                className="bg-border absolute left-3 w-px"
                style={{
                  top: stepIndex === 0 ? '50%' : 0,
                  bottom: stepIndex === card.steps.length - 1 ? '50%' : 0,
                }}
              />
              {/* Horizontal branch to the step content */}
              <div className="bg-border absolute top-1/2 left-3 h-px w-5 -translate-y-1/2" />
            </div>
            {/* Step content */}
            <div className="min-w-0 flex-1">
              <StepRow data={step} cardId={cardId} stepIndex={stepIndex} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export function ConditionBuilder() {
  const state = useBuilderState();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  if (state.cards.length === 0) {
    return <EmptyBuilder onAddCard={actions.addCard} disabled={meta.isDisabled} />;
  }

  return (
    <div className="space-y-0">
      {state.cards.map((card, cardIndex) => (
        <div key={card.id}>
          {/* Inter-card connector */}
          {cardIndex > 0 && card.cardConnector && (
            <LogicConnector
              variant="card"
              value={card.cardConnector}
              onChange={(value) => actions.setCardConnector(card.id, value as 'UNION' | 'INTERSECT')}
              disabled={meta.isDisabled}
            />
          )}

          <ConditionCard card={card} cardIndex={cardIndex} totalCards={state.cards.length}>
            {/* Steps within the card */}
            {card.steps.length > 1 ? (
              <StepsWithTrack card={card} cardId={card.id} actions={actions} meta={meta} />
            ) : (
              <div>
                {card.steps.map((step, stepIndex) => (
                  <StepRow key={step.id} data={step} cardId={card.id} stepIndex={stepIndex} />
                ))}
              </div>
            )}
          </ConditionCard>
        </div>
      ))}

      {/* Add card button */}
      <div className="flex flex-col items-center gap-0 pt-2">
        <div className="bg-border h-6 w-px" />
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground hover:border-primary hover:text-primary h-8 gap-1.5 rounded-full border-dashed px-4 text-xs font-medium"
          disabled={meta.isDisabled}
          onClick={actions.addCard}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar grupo
        </Button>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyBuilder({ onAddCard, disabled }: { onAddCard: () => void; disabled: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="border-border/60 bg-secondary/20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12">
      <div className="bg-secondary flex h-12 w-12 items-center justify-center rounded-xl">
        <Layers className="text-muted-foreground h-5 w-5" />
      </div>
      <p className="text-foreground mt-3 text-sm font-medium">
        {t('segments.builder.noConditions', 'Nenhuma condição')}
      </p>
      <p className="text-muted-foreground mt-1 max-w-[280px] text-center text-xs">
        {t('segments.builder.noConditionsDescription', 'Adicione grupos de condições para segmentar seus contatos')}
      </p>
      <Button variant="outline" size="sm" className="mt-4 gap-1.5 rounded-full" disabled={disabled} onClick={onAddCard}>
        <Plus className="h-3.5 w-3.5" />
        {t('segments.builder.addFirstGroup', 'Adicionar primeiro grupo')}
      </Button>
    </div>
  );
}
