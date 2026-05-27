import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: 'destructive' | 'default';
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, focus the confirm button on open instead of cancel */
  autoFocusAction?: boolean;
}

/**
 * Confirmation dialog using Radix AlertDialog for proper a11y:
 * - Focus moves to Cancel button on open (not the destructive action)
 * - Esc closes without confirming
 * - Cannot dismiss by clicking outside
 * - Focus returns to trigger on close
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  loading = false,
  variant = 'destructive',
  confirmLabel,
  cancelLabel,
  autoFocusAction = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={
          autoFocusAction
            ? (e) => {
                e.preventDefault();
                const buttons = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
                  '[data-slot="alert-dialog-footer"] button',
                );
                buttons[buttons.length - 1]?.focus();
              }
            : undefined
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel ?? t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={buttonVariants({
              variant: variant === 'destructive' ? 'destructive' : 'default',
            })}
          >
            {loading ? t('common.loading') : (confirmLabel ?? t('common.confirm'))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
