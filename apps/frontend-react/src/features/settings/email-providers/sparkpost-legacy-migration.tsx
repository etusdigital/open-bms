import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAccountId } from '../use-settings';
import { useEmailProviders } from './use-email-providers';
import { mapProviderError } from './provider-error-toast';

interface SparkpostLegacyStatus {
  legacyDetected: boolean;
  envValuePresent: boolean;
  perAccountConfigured: boolean;
}

const dismissKey = (accountId: number) => `email-providers:sparkpost-legacy-dismissed:${accountId}`;

function readDismissed(accountId: number): boolean {
  if (typeof window === 'undefined' || !accountId) return false;
  try {
    return window.sessionStorage.getItem(dismissKey(accountId)) === '1';
  } catch {
    return false;
  }
}

export function SparkpostLegacyMigration() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const { refresh } = useEmailProviders();

  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(accountId));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed(accountId));
  }, [accountId]);

  const statusQuery = useQuery<SparkpostLegacyStatus>({
    queryKey: ['sparkpost-legacy-status', accountId],
    queryFn: async () => {
      const res = await apiClient.get<SparkpostLegacyStatus>(`/accounts/${accountId}/settings/sparkpost/legacy-status`);
      return res.data;
    },
    enabled: !!accountId && !dismissed,
    staleTime: 60_000,
  });

  const migrate = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<SparkpostLegacyStatus>(`/accounts/${accountId}/settings/sparkpost/migrate-legacy`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('settings.emailProviders.legacyMigration.success'));
      refresh();
      void statusQuery.refetch();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(mapProviderError(err, 'SparkPost'));
    },
  });

  const shouldShow = useMemo(
    () => !dismissed && !!statusQuery.data?.legacyDetected,
    [dismissed, statusQuery.data],
  );

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  function handleSkip() {
    setOpen(false);
    setDismissed(true);
    if (typeof window === 'undefined' || !accountId) return;
    try {
      window.sessionStorage.setItem(dismissKey(accountId), '1');
    } catch {
      /* sessionStorage may be unavailable; non-fatal */
    }
  }

  if (!shouldShow) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleSkip();
      }}
    >
      <DialogContent data-testid="sparkpost-legacy-migration-dialog">
        <DialogHeader>
          <DialogTitle>{t('settings.emailProviders.legacyMigration.title')}</DialogTitle>
          <DialogDescription>{t('settings.emailProviders.legacyMigration.description')}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleSkip} disabled={migrate.isPending}>
            {t('settings.emailProviders.legacyMigration.keepAsIs')}
          </Button>
          <Button type="button" onClick={() => migrate.mutate()} disabled={migrate.isPending}>
            {migrate.isPending
              ? t('settings.emailProviders.legacyMigration.migrating')
              : t('settings.emailProviders.legacyMigration.migrateNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
