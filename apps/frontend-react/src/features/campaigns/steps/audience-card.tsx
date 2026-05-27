import { useTranslation } from 'react-i18next';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AudienceStepItem } from '../types';
import AudienceTagRow from './audience-tag-row';
import AudienceConditional from './audience-conditional';

interface AudienceCardProps {
  cardIndex: number;
  tagSteps: AudienceStepItem[];
  onUpdateStep: (stepIndex: number, updates: Partial<AudienceStepItem>) => void;
  onAddStep: () => void;
  onRemoveStep: (stepIndex: number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
}

export default function AudienceCard({
  cardIndex,
  tagSteps,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  onRemove,
  onDuplicate,
  canRemove,
}: AudienceCardProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid={`audience-card-${cardIndex}`}>
      {/* Card header with duplicate/remove actions */}
      <div className="flex items-center justify-end">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDuplicate}
            title={t('campaigns.audienceDuplicateCard')}
            data-testid={`audience-duplicate-${cardIndex}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-7 w-7"
              onClick={onRemove}
              title={t('campaigns.audienceRemoveCard')}
              data-testid={`audience-remove-${cardIndex}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tag step rows with step-level conditionals between them */}
      {tagSteps.map((step, stepIndex) => (
        <div key={stepIndex}>
          {/* Step-level conditional between rows (not on first row) */}
          {stepIndex > 0 && (
            <AudienceConditional
              value={step.conditional ?? 'UNION'}
              onChange={(v) => onUpdateStep(stepIndex, { conditional: v })}
              variant="step"
            />
          )}
          <AudienceTagRow
            step={step}
            onUpdate={(updates) => onUpdateStep(stepIndex, updates)}
            onRemove={() => onRemoveStep(stepIndex)}
            canRemove={tagSteps.length > 1}
          />
        </div>
      ))}

      {/* Add condition button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAddStep}
        className="gap-1.5 text-xs"
        data-testid={`audience-add-step-${cardIndex}`}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('campaigns.audienceAddStep')}
      </Button>
    </div>
  );
}
