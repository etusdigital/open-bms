import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type Recommended = {
  name: 'mailersend' | 'sparkpost' | 'resend' | 'sendgrid';
  label?: string;
  labelKey?: string;
  blurbKey: string;
};

const RECOMMENDED: readonly Recommended[] = [
  { name: 'mailersend', label: 'MailerSend', blurbKey: 'settings.emailProviders.wizard.mailersendBlurb' },
  { name: 'sparkpost', label: 'SparkPost', blurbKey: 'settings.emailProviders.wizard.sparkpostBlurb' },
  { name: 'resend', label: 'Resend', blurbKey: 'settings.emailProviders.wizard.resendBlurb' },
  { name: 'sendgrid', labelKey: 'settings.emailProviders.wizard.sendgridLabel', blurbKey: 'settings.emailProviders.wizard.sendgridBlurb' },
];

type RecommendedName = Recommended['name'];

interface FirstTimeWizardProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (providerName: RecommendedName) => void;
  onSkip: () => void;
}

export function FirstTimeWizard({ open, onOpenChange, onSelect, onSkip }: FirstTimeWizardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RecommendedName>('mailersend');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="first-time-wizard">
        <DialogHeader>
          <DialogTitle>{t('settings.emailProviders.wizard.title')}</DialogTitle>
          <DialogDescription>{t('settings.emailProviders.wizard.description')}</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label={t('settings.emailProviders.wizard.ariaLabel')} className="flex flex-col gap-2">
          {RECOMMENDED.map((p) => {
            const isSelected = selected === p.name;
            const label = p.labelKey ? t(p.labelKey as 'settings.emailProviders.wizard.sendgridLabel') : p.label;
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
                  <Label className="cursor-pointer">{label}</Label>
                  <p className="text-muted-foreground text-xs">{t(p.blurbKey as 'settings.emailProviders.wizard.mailersendBlurb')}</p>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t('settings.emailProviders.wizard.skip')}
          </Button>
          <Button type="button" onClick={() => onSelect(selected)}>
            {t('settings.emailProviders.wizard.next')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
