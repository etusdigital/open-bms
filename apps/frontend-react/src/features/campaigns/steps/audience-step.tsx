import { useCallback, useEffect } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { CampaignFormValues } from '../campaign-schema';
import type { AudienceCard as AudienceCardType, AudienceStepItem } from '../types';
import { useCountContacts } from '../use-campaigns';
import AudienceCard from './audience-card';
import AudienceConditional from './audience-conditional';

interface AudienceStepProps {
  form: UseFormReturn<CampaignFormValues>;
  isCampaignRule?: boolean;
  isSuperAdmin?: boolean;
}

/** Create a default empty tag step */
function createEmptyTagStep(): AudienceStepItem {
  return { type: 'tag', conditional_tag: 'in', tag_id: [], tag_info: [] };
}

export default function AudienceStep({
  form,
  isCampaignRule: _isCampaignRule = false,
  isSuperAdmin = false,
}: AudienceStepProps) {
  const { t } = useTranslation();
  const sendToAll = form.watch('sendToAll');
  const steps = form.watch('steps') ?? [];
  const messageType = form.watch('messageType');
  const countContacts = useCountContacts();

  const showSendToAllRadio = messageType !== 'email';

  const updateSteps = useCallback(
    (newSteps: AudienceCardType[]) => {
      form.setValue('steps', newSteps as CampaignFormValues['steps']);
    },
    [form],
  );

  // ─── Card CRUD ──────────────────────────────────────────────────────────────

  const handleAddCard = () => {
    const newSteps = [...steps];
    if (newSteps.length > 0) {
      // Non-first cards start with a conditionalCard entry
      newSteps.push([{ type: 'conditionalCard', value: 'UNION' }, createEmptyTagStep()]);
    } else {
      newSteps.push([createEmptyTagStep()]);
    }
    updateSteps(newSteps);
  };

  const handleRemoveCard = (cardIndex: number) => {
    const newSteps = [...steps];
    newSteps.splice(cardIndex, 1);

    // If the new first card has a conditionalCard prefix, strip it
    if (newSteps.length > 0 && newSteps[0]?.[0]?.type === 'conditionalCard') {
      newSteps[0] = newSteps[0].slice(1);
    }

    updateSteps(newSteps);
  };

  const handleDuplicateCard = (cardIndex: number) => {
    const card = steps[cardIndex];
    // Deep-copy tag steps (skip conditionalCard if present), wrap with conditionalCard prefix
    const hasCC = card[0]?.type === 'conditionalCard';
    const tagSteps = hasCC ? card.slice(1) : card;
    const copiedSteps = tagSteps.map((item) => ({
      ...item,
      tag_id: item.tag_id ? [...item.tag_id] : [],
      tag_info: item.tag_info ? item.tag_info.map((t) => ({ ...t })) : [],
      isCardCopy: true,
    }));

    const newCard: AudienceCardType = [{ type: 'conditionalCard', value: 'UNION' }, ...copiedSteps];

    const newSteps = [...steps];
    newSteps.splice(cardIndex + 1, 0, newCard);
    updateSteps(newSteps);
  };

  // ─── Card-level conditional (E / EXCETO between cards) ──────────────────────

  const handleConditionalChange = (cardIndex: number, value: 'UNION' | 'EXCEPT') => {
    const newSteps = [...steps];
    const card = [...newSteps[cardIndex]];
    if (card[0]?.type === 'conditionalCard') {
      card[0] = { ...card[0], value };
    }
    newSteps[cardIndex] = card;
    updateSteps(newSteps);
  };

  // ─── Step CRUD within cards ─────────────────────────────────────────────────

  const handleAddStep = (cardIndex: number) => {
    const newSteps = [...steps];
    const card = [...newSteps[cardIndex]];
    // Second+ tag steps get a `conditional` field
    card.push({
      ...createEmptyTagStep(),
      conditional: 'UNION',
    });
    newSteps[cardIndex] = card;
    updateSteps(newSteps);
  };

  const handleRemoveStep = (cardIndex: number, stepIndex: number) => {
    const newSteps = [...steps];
    const card = [...newSteps[cardIndex]];
    const hasCC = card[0]?.type === 'conditionalCard';
    const actualIndex = hasCC ? stepIndex + 1 : stepIndex;

    card.splice(actualIndex, 1);

    // If we removed the first tag step and a new one takes its place, strip its `conditional`
    const firstTagIndex = hasCC ? 1 : 0;
    if (card[firstTagIndex] && card[firstTagIndex].conditional) {
      card[firstTagIndex] = { ...card[firstTagIndex] };
      delete card[firstTagIndex].conditional;
    }

    newSteps[cardIndex] = card;
    updateSteps(newSteps);
  };

  const handleUpdateStep = (cardIndex: number, stepIndex: number, updates: Partial<AudienceStepItem>) => {
    const newSteps = [...steps];
    const card = [...newSteps[cardIndex]];
    const hasCC = card[0]?.type === 'conditionalCard';
    const actualIndex = hasCC ? stepIndex + 1 : stepIndex;

    card[actualIndex] = { ...card[actualIndex], ...updates };
    newSteps[cardIndex] = card;
    updateSteps(newSteps);
  };

  // ─── Contact count ──────────────────────────────────────────────────────────

  const handleCountContacts = () => {
    const values = form.getValues();
    countContacts.mutate(values as any);
  };

  // ─── Initialize with one empty card ─────────────────────────────────────────

  useEffect(() => {
    if (!sendToAll && steps.length === 0) {
      updateSteps([[createEmptyTagStep()]]);
    }
  }, [sendToAll, steps.length, updateSteps]);

  return (
    <div className="space-y-6" data-testid="audience-step">
      {/* Send to all toggle (only for non-email) */}
      {showSendToAllRadio && (
        <div className="space-y-2" data-testid="send-to-radio">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
              sendToAll ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}
            onClick={() => form.setValue('sendToAll', true)}
          >
            <div
              className={cn(
                'h-4 w-4 rounded-full border-2',
                sendToAll ? 'border-primary bg-primary' : 'border-muted-foreground',
              )}
            />
            {t('campaigns.sendToAllLabel')}
          </button>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
              !sendToAll ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            )}
            onClick={() => form.setValue('sendToAll', false)}
          >
            <div
              className={cn(
                'h-4 w-4 rounded-full border-2',
                !sendToAll ? 'border-primary bg-primary' : 'border-muted-foreground',
              )}
            />
            {t('campaigns.sendToTagsLabel')}
          </button>
        </div>
      )}

      {/* Tag-based audience */}
      {!sendToAll && (
        <div className="space-y-3">
          {steps.map((card, cardIndex) => {
            const hasCC = card[0]?.type === 'conditionalCard';
            const ccValue = hasCC ? (card[0].value as 'UNION' | 'EXCEPT') : 'UNION';
            const tagSteps = hasCC ? card.slice(1) : card;

            return (
              <div key={cardIndex}>
                {/* Card-level conditional between cards */}
                {cardIndex > 0 && (
                  <AudienceConditional
                    value={ccValue}
                    onChange={(v) => handleConditionalChange(cardIndex, v)}
                    variant="card"
                  />
                )}
                <AudienceCard
                  cardIndex={cardIndex}
                  tagSteps={tagSteps}
                  onUpdateStep={(si, upd) => handleUpdateStep(cardIndex, si, upd)}
                  onAddStep={() => handleAddStep(cardIndex)}
                  onRemoveStep={(si) => handleRemoveStep(cardIndex, si)}
                  onRemove={() => handleRemoveCard(cardIndex)}
                  onDuplicate={() => handleDuplicateCard(cardIndex)}
                  canRemove={steps.length > 1}
                />
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCard}
            className="gap-2"
            data-testid="audience-add-card"
          >
            <Plus className="h-4 w-4" />
            {t('campaigns.audienceAddCard')}
          </Button>

          {/* Contact count */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCountContacts}
              disabled={countContacts.isPending}
            >
              {countContacts.isPending ? t('common.loading') : t('campaigns.audienceContacts')}
            </Button>
            {countContacts.data !== undefined && (
              <span className="text-sm font-medium" data-testid="contacts-count">
                {Number(countContacts.data).toLocaleString()} {t('campaigns.audienceContacts')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Run segment toggle */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3 pt-2">
          <Checkbox
            checked={form.watch('runSegment')}
            onCheckedChange={(v) => form.setValue('runSegment', v === true)}
            data-testid="run-segment-toggle"
          />
          <Label>{t('campaigns.audienceRunSegment')}</Label>
        </div>
      )}
    </div>
  );
}
