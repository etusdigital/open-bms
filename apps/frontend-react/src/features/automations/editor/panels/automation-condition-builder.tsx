/**
 * Simplified condition builder for automations.
 * Renders a single group of conditions (no multi-group, no duplicate/delete group).
 * Reuses the segment builder's step components and context.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBuilderState, useBuilderActions, useBuilderMeta } from '@/features/segments/builder/builder-context';
import { LogicConnector } from '@/features/segments/builder/logic-connector';
import { AutomationInteractionStep } from './automation-interaction-step';
import { UserFieldStep } from '@/features/segments/builder/user-field-step';
import { AutomationCustomFieldStep } from './automation-custom-field-step';
import { TagStep } from '@/features/segments/builder/tag-step';
import { AutomationAutomationStateStep } from './automation-automation-state-step';
import { UnsupportedStep } from '@/features/segments/builder/unsupported-step';
import { AutomationLeadStep } from './automation-lead-step';
import type { StepData, StepType, UnsupportedStepData } from '@/features/segments/builder/types';

// ---------------------------------------------------------------------------
// Step type labels and registry
// ---------------------------------------------------------------------------

const STEP_TYPE_LABELS: Record<StepType, string> = {
  interation: 'segments.builder.stepTypes.interaction',
  custom_field: 'segments.builder.stepTypes.customField',
  user_field: 'segments.builder.stepTypes.contactField',
  tag: 'segments.builder.stepTypes.tag',
  automation_state: 'automations.editor.automationFilter.stepLabel',
  lead: 'automations.editor.lead.title',
};

const STEP_COMPONENTS: Record<string, React.ComponentType<{ data: any; cardId: string }>> = {
  interation: AutomationInteractionStep,
  custom_field: AutomationCustomFieldStep,
  user_field: UserFieldStep,
  tag: TagStep,
  automation_state: AutomationAutomationStateStep,
  lead: AutomationLeadStep,
};

// ---------------------------------------------------------------------------
// Step renderer
// ---------------------------------------------------------------------------

function StepRenderer({ data, cardId }: { data: StepData; cardId: string }) {
  if (data.type === 'unknown') {
    return <UnsupportedStep data={data as UnsupportedStepData} />;
  }
  const Component = STEP_COMPONENTS[data.type];
  if (Component) return <Component data={data} cardId={cardId} />;
  return (
    <div className="bg-secondary/30 text-muted-foreground rounded-lg p-3 text-xs">
      <code>{data.type}</code>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step row with delete button
// ---------------------------------------------------------------------------

const StepRow = memo(function StepRow({ data, cardId }: { data: StepData; cardId: string }) {
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  return (
    <div className="group flex items-start">
      <div className="flex-1">
        <StepRenderer data={data} cardId={cardId} />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive mt-2 ml-1 h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        disabled={meta.isDisabled}
        onClick={() => actions.removeStep(cardId, data.id)}
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main builder — single card, no group management
// ---------------------------------------------------------------------------

export function AutomationConditionBuilder() {
  const { t } = useTranslation();
  const state = useBuilderState();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();

  // Use the first (and only) card
  const card = state.cards[0];
  if (!card) {
    return (
      <div className="py-6 text-center">
        <Button variant="outline" size="sm" onClick={actions.addCard}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('automations.editor.conditions.addFirstRule')}
        </Button>
      </div>
    );
  }

  const availableTypes = meta.availableStepTypes(card);

  return (
    <div className="space-y-3">
      {card.steps.length === 0 ? (
        <div className="bg-secondary/20 flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
          <div className="flex-1">
            <p className="text-sm font-medium">{t('automations.editor.conditions.noRules')}</p>
            <p className="text-muted-foreground text-xs">{t('automations.editor.conditions.addRuleHint')}</p>
          </div>
          <AddRuleButton onAdd={(type) => actions.addStep(card.id, type)} availableTypes={availableTypes} />
        </div>
      ) : (
        <>
          {card.steps.map((step, stepIndex) => (
            <div key={step.id}>
              {/* AND/OR connector between rules */}
              {stepIndex > 0 && step.stepConnector && (
                <div className="flex items-center py-1.5">
                  <div className="bg-border h-px flex-1" />
                  <LogicConnector
                    variant="step"
                    value={step.stepConnector}
                    onChange={(value) => actions.setStepConnector(card.id, step.id, value as 'and' | 'or')}
                    disabled={meta.isDisabled}
                  />
                  <div className="bg-border h-px flex-1" />
                </div>
              )}
              <StepRow data={step} cardId={card.id} />
            </div>
          ))}

          <div className="pt-1">
            <AddRuleButton onAdd={(type) => actions.addStep(card.id, type)} availableTypes={availableTypes} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add rule button
// ---------------------------------------------------------------------------

function AddRuleButton({ onAdd, availableTypes }: { onAdd: (type: StepType) => void; availableTypes: StepType[] }) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="border-primary/30 text-primary hover:border-primary hover:bg-primary/5 h-7 gap-1.5 rounded-full border border-dashed px-3 text-xs font-medium"
        >
          <Plus className="h-3 w-3" />
          {t('automations.editor.conditions.addRule')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {availableTypes.map((type) => (
          <DropdownMenuItem key={type} onClick={() => onAdd(type)} className="text-xs">
            {t(STEP_TYPE_LABELS[type], type)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
