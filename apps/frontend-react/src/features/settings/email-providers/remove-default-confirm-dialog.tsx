import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import type { ProviderState } from './use-email-providers';

interface RemoveDefaultConfirmDialogProps {
  open: boolean;
  providerBeingRemoved: string;
  providerBeingRemovedLabel: string;
  defaultProvider: string | null;
  configuredProviders: ProviderState[];
  onConfirm: (newDefault: string) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

export function RemoveDefaultConfirmDialog({
  open,
  providerBeingRemoved,
  providerBeingRemovedLabel,
  defaultProvider,
  configuredProviders,
  onConfirm,
  onCancel,
  submitting,
}: RemoveDefaultConfirmDialogProps) {
  const { t } = useTranslation();
  const alternates = configuredProviders.filter((p) => p.name !== providerBeingRemoved);
  const [selected, setSelected] = useState<string>(alternates[0]?.name ?? '');

  useEffect(() => {
    if (open) {
      setSelected(alternates[0]?.name ?? '');
    }
  }, [open, alternates]);

  const hasAlternates = alternates.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent data-testid="remove-default-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('settings.emailProviders.removeDefault.title', { provider: providerBeingRemovedLabel })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('settings.emailProviders.removeDefault.description', {
              provider: providerBeingRemovedLabel,
              providerName: defaultProvider ?? '',
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasAlternates ? (
          <div role="radiogroup" aria-label={t('settings.emailProviders.removeDefault.ariaLabel')} className="flex flex-col gap-2">
            {alternates.map((p) => {
              const isSelected = selected === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelected(p.name)}
                  className={[
                    'flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm',
                    isSelected ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      isSelected ? 'border-primary' : 'border-input',
                    ].join(' ')}
                  >
                    {isSelected && <span className="bg-primary h-2 w-2 rounded-full" />}
                  </span>
                  <Label className="cursor-pointer">{p.label}</Label>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm" data-testid="remove-default-no-alternates">
            {t('settings.emailProviders.removeDefault.noAlternates')}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={submitting}>
            {t('settings.emailProviders.removeDefault.cancel')}
          </AlertDialogCancel>
          {hasAlternates && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!selected) return;
                void onConfirm(selected);
              }}
              disabled={submitting || !selected}
            >
              {submitting
                ? t('settings.emailProviders.removeDefault.applying')
                : t('settings.emailProviders.removeDefault.swapAndRemove')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
