import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useAccountId } from './use-settings';
import { useListApiKeys, useCreateApiKey, useRevokeApiKey } from './use-settings';
import type { ManagedApiKey } from './use-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('settings.apiKeyCopied') ?? 'Erro ao copiar');
    }
  }, [value, t]);
  return (
    <Button variant="outline" size="icon" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function CreatedKeyDialog({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.apiKeysCreatedTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('settings.apiKeysCreatedWarning')}</p>
        <div className="flex items-center gap-2">
          <Input value={apiKey} readOnly className="font-mono text-sm" />
          <CopyButton value={apiKey} />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeyRow({ apiKey, onRevoke, canRevoke }: { apiKey: ManagedApiKey; onRevoke: (id: number) => void; canRevoke: boolean }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between rounded-md border px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{apiKey.name}</p>
          <p className="text-xs text-muted-foreground">
            {t('settings.apiKeysCreatedAt')}: {new Date(apiKey.createdAt).toLocaleDateString()}
            {apiKey.lastUsedAt && (
              <> · {t('settings.apiKeysLastUsed')}: {new Date(apiKey.lastUsedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
        {canRevoke && (
          <Button variant="ghost" size="icon" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.apiKeysRevokeConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.apiKeysRevokeDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRevoke(apiKey.id);
                setConfirming(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('settings.apiKeysRevokeBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ApiKeysTab() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const accountId = useAccountId();
  const { data: keys = [], isLoading } = useListApiKeys(accountId);
  const createKey = useCreateApiKey(accountId);
  const revokeKey = useRevokeApiKey(accountId);

  const canCreate = can('account:api_keys_create');
  const canRevoke = can('account:api_keys_revoke');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    const result = await createKey.mutateAsync(name.trim());
    setName('');
    setCreateOpen(false);
    setNewKey(result.apiKey);
  }, [name, createKey]);

  const activeKeys = keys.filter((k) => k.status === 'active');

  return (
    <div className="max-w-lg space-y-4">
      {newKey && (
        <CreatedKeyDialog apiKey={newKey} onClose={() => setNewKey(null)} />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('settings.tabApi_keys')}</h3>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            {t('settings.apiKeysCreate')}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      {!isLoading && activeKeys.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('settings.apiKeysEmpty')}</p>
      )}

      <div className="space-y-2">
        {activeKeys.map((k) => (
          <KeyRow key={k.id} apiKey={k} onRevoke={(id) => revokeKey.mutate(id)} canRevoke={canRevoke} />
        ))}
      </div>

      {canCreate && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.apiKeysCreateTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.apiKeysNameLabel')}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.apiKeysNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={!name.trim() || createKey.isPending}>
                {createKey.isPending ? t('common.loading') : t('settings.apiKeysCreateBtn')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
