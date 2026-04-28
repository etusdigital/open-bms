import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Trash2, Plus, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import type { BuilderCard, StepType } from './types';

const STEP_TYPE_LABELS: Record<StepType, string> = {
  interation: 'segments.builder.stepTypes.interaction',
  custom_field: 'segments.builder.stepTypes.customField',
  user_field: 'segments.builder.stepTypes.contactField',
  tag: 'segments.builder.stepTypes.tag',
  automation_state: 'segments.builder.stepTypes.automationState',
  custom_event: 'segments.builder.stepTypes.customEvent',
  lead: 'segments.builder.stepTypes.lead',
};

interface ConditionCardProps {
  card: BuilderCard;
  cardIndex: number;
  totalCards: number;
  children: React.ReactNode;
}

export const ConditionCard = memo(function ConditionCard({
  card,
  cardIndex,
  totalCards,
  children,
}: ConditionCardProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();
  const availableTypes = meta.availableStepTypes(card);

  return (
    <Card
      className="border-border/60 relative shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.06)]"
      role="group"
      aria-label={t('segments.builder.conditionGroup', { n: cardIndex + 1, total: totalCards })}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="bg-secondary text-secondary-foreground flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-semibold">
            {cardIndex + 1}
          </div>
          <span className="text-muted-foreground text-sm font-medium tracking-tight">
            {t('segments.builder.conditionGroupLabel', 'Grupo de Condições')}
          </span>
        </div>
        <CardAction>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-7 w-7"
                  disabled={meta.isDisabled}
                  onClick={() => actions.duplicateCard(card.id)}
                  aria-label={t('common.duplicate', 'Duplicar')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.duplicate', 'Duplicar')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-7 w-7"
                  disabled={meta.isDisabled}
                  onClick={() => actions.removeCard(card.id)}
                  aria-label={t('common.delete', 'Excluir')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.delete', 'Excluir')}</TooltipContent>
            </Tooltip>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-0 pt-0">
        {card.steps.length === 0 ? (
          <EmptyCardState
            onAdd={(type) => actions.addStep(card.id, type)}
            availableTypes={availableTypes}
            disabled={meta.isDisabled}
          />
        ) : (
          <>
            {children}
            <div className="pt-3">
              <AddStepButton
                onAdd={(type) => actions.addStep(card.id, type)}
                availableTypes={availableTypes}
                disabled={meta.isDisabled}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

// ─── Add Step Button ─────────────────────────────────────────────────────────

function AddStepButton({
  onAdd,
  availableTypes,
  disabled,
}: {
  onAdd: (type: StepType) => void;
  availableTypes: StepType[];
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="border-primary/30 text-primary hover:border-primary hover:bg-primary/5 h-7 gap-1.5 rounded-full border border-dashed px-3 text-xs font-medium"
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
          {t('segments.builder.addCondition', 'Adicionar condição')}
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

// ─── Empty Card State ────────────────────────────────────────────────────────

function EmptyCardState({
  onAdd,
  availableTypes,
  disabled,
}: {
  onAdd: (type: StepType) => void;
  availableTypes: StepType[];
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-border/60 bg-secondary/20 flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
      <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-lg">
        <Filter className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-foreground text-sm font-medium">{t('segments.builder.emptyGroup', 'Grupo vazio')}</p>
        <p className="text-muted-foreground text-xs">
          {t('segments.builder.emptyGroupHint', 'Adicione condições para filtrar contatos')}
        </p>
      </div>
      <AddStepButton onAdd={onAdd} availableTypes={availableTypes} disabled={disabled} />
    </div>
  );
}
