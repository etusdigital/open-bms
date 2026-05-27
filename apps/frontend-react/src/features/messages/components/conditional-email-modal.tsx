import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConditionalEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONDITIONAL_EXAMPLE = `{{#if customFields.negativado}}
  <p>Negativado</p>
{{else}}
  <p>Não negativado</p>
{{/if}}`;

export function ConditionalEmailModal({ open, onOpenChange }: ConditionalEmailModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CONDITIONAL_EXAMPLE);
      setCopied(true);
      toast.success(t('messages.conditionalCopySuccess'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('messages.conditionalCopyError'));
    }
  }, [t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('messages.conditionalEmail')}</DialogTitle>
          <DialogDescription>{t('messages.conditionalTutorial')}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted relative rounded-md p-4 font-mono text-sm whitespace-pre">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleCopy}
            aria-label={t('messages.conditionalCopyExample')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {CONDITIONAL_EXAMPLE}
        </div>

        <p className="text-muted-foreground text-sm">
          {t('messages.conditionalAvailableFields')} <strong>customFields</strong> (Ex: customFields.negativado){' '}
          {t('common.and')} <strong>tags</strong> (Ex: tags.tag-negativado)
        </p>
      </DialogContent>
    </Dialog>
  );
}
