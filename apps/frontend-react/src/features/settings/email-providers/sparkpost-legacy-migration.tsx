import { useEffect, useMemo, useState } from 'react';
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
      toast.success('SparkPost migrado para configuração per-account.');
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
          <DialogTitle>Migrar SparkPost para configuração per-account</DialogTitle>
          <DialogDescription>
            Detectamos que esta conta está usando a configuração SparkPost legada (variável de ambiente
            <span className="font-mono"> SPARKPOST_API_KEY</span>). Migrar agora copia essa chave para a configuração
            per-account, permitindo gerir credenciais e default por conta.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleSkip} disabled={migrate.isPending}>
            Manter como está
          </Button>
          <Button type="button" onClick={() => migrate.mutate()} disabled={migrate.isPending}>
            {migrate.isPending ? 'Migrando…' : 'Migrar agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
