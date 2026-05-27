import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, Mail } from 'lucide-react';
import type { AutomationStepType } from '../types';

interface AddStepModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (stepType: AutomationStepType) => void;
}

const STEP_OPTIONS: Array<{
  type: AutomationStepType;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  descriptionKey: string;
  category: string;
}> = [
  {
    type: 'wait',
    icon: Clock,
    labelKey: 'automations.editor.wait',
    descriptionKey: 'automations.editor.waitDescription',
    category: 'conditions',
  },
  {
    type: 'email',
    icon: Mail,
    labelKey: 'automations.editor.email',
    descriptionKey: 'automations.editor.emailDescription',
    category: 'send',
  },
];

export function AddStepModal({ open, onOpenChange, onSelect }: AddStepModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('automations.editor.addStep')}</DialogTitle>
          <DialogDescription>{t('automations.editor.addStepDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          {STEP_OPTIONS.map((option) => (
            <Button
              key={option.type}
              variant="outline"
              className="h-auto justify-start gap-3 py-3"
              onClick={() => {
                onSelect(option.type);
                onOpenChange(false);
              }}
            >
              <option.icon className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">{t(option.labelKey as never)}</p>
                <p className="text-muted-foreground text-xs">{t(option.descriptionKey as never)}</p>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
