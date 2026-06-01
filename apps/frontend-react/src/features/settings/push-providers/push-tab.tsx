import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { useAccountId } from '../use-settings';
import { accountPushGateway, type AccountPushSettings } from './push-account-gateway';

export function PushTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can('account:settings_update');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'push', accountId],
    queryFn: () => accountPushGateway.get(accountId),
    enabled: accountId > 0,
  });

  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => accountPushGateway.save(accountId, { firebaseServiceAccount: json.trim() }),
    onSuccess: (res: AccountPushSettings) => {
      qc.setQueryData(['settings', 'push', accountId], res);
      setJson('');
      toast.success(t('settings.pushSaved') ?? 'Push salvo.');
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Erro ao salvar.'),
  });

  const remove = useMutation({
    mutationFn: () => accountPushGateway.remove(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'push', accountId] });
      setJson('');
      toast.success(t('settings.pushRemoved') ?? 'Push removido.');
    },
  });

  const test = useMutation({
    mutationFn: () => accountPushGateway.test(accountId, json.trim()),
    onSuccess: (res) => {
      if (res.ok) toast.success(t('settings.pushTestOk') ?? 'Service account válido.');
      else toast.error(res.errorMessage ?? (t('settings.pushTestFail') ?? 'Falha na validação.'));
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro no teste.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">{t('common.loading') ?? 'Carregando...'}</p>;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div>
        <h3 className="text-lg font-medium">Push (Mobile + Web)</h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.pushDescription') ?? 'Firebase service account (JSON) desta conta. Usado para push mobile e web. Sem config, usa a credencial da plataforma.'}
        </p>
        {data?.source === 'account' && <p className="text-muted-foreground mt-1 text-xs">Configurado nesta conta ✓</p>}
        {data?.source === 'platform' && <p className="text-muted-foreground mt-1 text-xs">Usando credencial da plataforma (super-admin). Configure abaixo para sobrescrever.</p>}
        {data?.source === 'none' && <p className="text-muted-foreground mt-1 text-xs">Nenhuma credencial configurada — push não funcionará até configurar.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="push-json">Firebase Service Account (JSON)</Label>
        <Textarea
          id="push-json"
          rows={8}
          className="font-mono text-xs"
          placeholder={data?.source === 'account' ? '•••••••• (configurado — cole novo JSON para substituir)' : '{ "type": "service_account", "project_id": "...", ... }'}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          disabled={!canEdit}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canEdit || save.isPending || !json.trim()}>
          {save.isPending ? '...' : (t('common.save') ?? 'Salvar')}
        </Button>
        <Button type="button" variant="outline" disabled={!canEdit || test.isPending || !json.trim()} onClick={() => test.mutate()}>
          {test.isPending ? '...' : (t('settings.testConnection') ?? 'Testar')}
        </Button>
        {data?.source === 'account' && (
          <Button type="button" variant="destructive" disabled={!canEdit || remove.isPending} onClick={() => remove.mutate()}>
            {t('common.remove') ?? 'Remover'}
          </Button>
        )}
      </div>
    </form>
  );
}
