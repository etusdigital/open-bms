import { useBlocker } from '@tanstack/react-router';
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

interface UnsavedChangesDialogProps {
  isDirty: boolean;
  isPending?: boolean;
}

export function UnsavedChangesDialog({ isDirty, isPending = false }: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !isPending,
    enableBeforeUnload: () => isDirty && !isPending,
    withResolver: true,
  });

  return (
    <AlertDialog
      open={blocker.status === 'blocked'}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.unsavedChangesTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('common.unsavedChangesMessage')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>{t('common.stay')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>{t('common.leave')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
