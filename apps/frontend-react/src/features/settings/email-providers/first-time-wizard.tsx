import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const RECOMMENDED = [
  { name: 'mailersend', label: 'MailerSend', blurb: '12k emails/mês grátis, sem cartão.' },
  { name: 'sparkpost', label: 'SparkPost', blurb: '500 emails/dia grátis, ótimo para começar.' },
  { name: 'resend', label: 'Resend', blurb: '3k emails/mês grátis, DX moderno.' },
  { name: 'sendgrid', label: 'Já tenho conta SendGrid', blurb: 'Use sua API key existente.' },
] as const;

type RecommendedName = (typeof RECOMMENDED)[number]['name'];

interface FirstTimeWizardProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (providerName: RecommendedName) => void;
  onSkip: () => void;
}

export function FirstTimeWizard({ open, onOpenChange, onSelect, onSkip }: FirstTimeWizardProps) {
  const [selected, setSelected] = useState<RecommendedName>('mailersend');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="first-time-wizard">
        <DialogHeader>
          <DialogTitle>Vamos configurar seu primeiro email provider</DialogTitle>
          <DialogDescription>
            Recomendamos começar por um provider com free tier — você pode mudar depois.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Email provider recomendado" className="flex flex-col gap-2">
          {RECOMMENDED.map((p) => {
            const isSelected = selected === p.name;
            return (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(p.name)}
                className={[
                  'flex items-start gap-3 rounded-md border px-3 py-2 text-left text-sm',
                  isSelected ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    isSelected ? 'border-primary' : 'border-input',
                  ].join(' ')}
                >
                  {isSelected && <span className="bg-primary h-2 w-2 rounded-full" />}
                </span>
                <span>
                  <Label className="cursor-pointer">{p.label}</Label>
                  <p className="text-muted-foreground text-xs">{p.blurb}</p>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onSkip}>
            Pular wizard
          </Button>
          <Button type="button" onClick={() => onSelect(selected)}>
            Próximo →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
