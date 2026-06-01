import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { useAccountId } from '../use-settings';
import { accountTwilioGateway, type AccountTwilioSettings } from './twilio-account-gateway';

export function TwilioTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can('account:settings_update');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'twilio', accountId],
    queryFn: () => accountTwilioGateway.get(accountId),
    enabled: accountId > 0,
  });

  const [accountSid, setAccountSid] = useState('');
  const [apiSid, setApiSid] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [smsServiceSid, setSmsServiceSid] = useState('');
  const [whatsappServiceSid, setWhatsappServiceSid] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Secrets are write-only: GET never returns them. Show the masked Account SID
  // and "configured" flags; leave secret inputs blank (only sent if filled).
  useEffect(() => {
    if (data) setAccountSid(data.accountSidMasked ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      accountTwilioGateway.save(accountId, {
        accountSid: accountSid.trim(),
        apiSid: apiSid.trim(),
        apiSecret: apiSecret.trim(),
        authToken: authToken.trim() || undefined,
        smsServiceSid: smsServiceSid.trim() || undefined,
        whatsappServiceSid: whatsappServiceSid.trim() || undefined,
      }),
    onSuccess: (res: AccountTwilioSettings) => {
      qc.setQueryData(['settings', 'twilio', accountId], res);
      setApiSecret('');
      setAuthToken('');
      toast.success(t('settings.twilioSaved') ?? 'Twilio salvo.');
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Erro ao salvar.'),
  });

  const remove = useMutation({
    mutationFn: () => accountTwilioGateway.remove(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'twilio', accountId] });
      setAccountSid('');
      setApiSid('');
      setApiSecret('');
      setAuthToken('');
      setSmsServiceSid('');
      setWhatsappServiceSid('');
      toast.success(t('settings.twilioRemoved') ?? 'Twilio removido.');
    },
  });

  const test = useMutation({
    mutationFn: () => accountTwilioGateway.test(accountId, { accountSid: accountSid.trim(), apiSid: apiSid.trim(), apiSecret: apiSecret.trim() }),
    onSuccess: (res) => {
      if (res.ok) toast.success(t('settings.twilioTestOk') ?? 'Conexão OK.');
      else toast.error(res.errorMessage ?? (t('settings.twilioTestFail') ?? 'Falha no teste.'));
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
        <h3 className="text-lg font-medium">Twilio (SMS + WhatsApp)</h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.twilioDescription') ?? 'Credenciais Twilio desta conta. Usadas para envio de SMS e WhatsApp via Twilio.'}
        </p>
        {data?.source === 'account' && (
          <p className="text-muted-foreground mt-1 text-xs">
            {`Configurado · SMS: ${data.hasSms ? '✓' : '—'} · WhatsApp: ${data.hasWhatsapp ? '✓' : '—'} · Auth Token: ${data.hasAuthToken ? '✓' : '—'}`}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tw-account-sid">Account SID</Label>
        <Input id="tw-account-sid" placeholder="ACxxxxxxxx..." value={accountSid} onChange={(e) => setAccountSid(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tw-api-sid">API Key SID</Label>
        <Input id="tw-api-sid" placeholder="SKxxxxxxxx..." value={apiSid} onChange={(e) => setApiSid(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tw-api-secret">API Key Secret</Label>
        <Input id="tw-api-secret" type="password" placeholder={data?.hasSecret ? '•••••••• (configurado)' : ''} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} disabled={!canEdit} autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tw-auth-token">Auth Token {whatsappServiceSid ? '(obrigatório para WhatsApp)' : '(opcional)'}</Label>
        <Input id="tw-auth-token" type="password" placeholder={data?.hasAuthToken ? '•••••••• (configurado)' : ''} value={authToken} onChange={(e) => setAuthToken(e.target.value)} disabled={!canEdit} autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tw-sms-service">SMS Messaging Service SID (opcional)</Label>
        <Input id="tw-sms-service" placeholder="MGxxxxxxxx..." value={smsServiceSid} onChange={(e) => setSmsServiceSid(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tw-wa-service">WhatsApp Messaging Service SID (opcional)</Label>
        <Input id="tw-wa-service" placeholder="MGxxxxxxxx..." value={whatsappServiceSid} onChange={(e) => setWhatsappServiceSid(e.target.value)} disabled={!canEdit} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canEdit || save.isPending}>
          {save.isPending ? '...' : (t('common.save') ?? 'Salvar')}
        </Button>
        <Button type="button" variant="outline" disabled={!canEdit || test.isPending || !accountSid || !apiSid || !apiSecret} onClick={() => test.mutate()}>
          {test.isPending ? '...' : (t('settings.testConnection') ?? 'Testar conexão')}
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
