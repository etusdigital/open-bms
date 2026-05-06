import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Eye, EyeOff, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountId } from './use-settings';
import { accountSendgridGateway, type AccountSendgridSettings } from './sendgrid-account-gateway';

const SENDGRID_API_KEY_PREFIX = 'SG.';
const SENDGRID_API_KEY_MIN_LENGTH = 10;

// Per-account SendGrid configuration. Each tenant pastes their own
// SendGrid API key here; the backend registers an event webhook against
// that key pointed at this BMS instance with `&account=<id>` so the
// event-process worker can route incoming events to the right tenant.
// There is no platform-wide fallback — without a per-account key the
// account simply cannot send.
export function SendgridAccountTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const [stored, setStored] = useState<AccountSendgridSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    accountSendgridGateway
      .get(accountId)
      .then((value) => {
        if (cancelled) return;
        setStored(value);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('settings.sendgridLoadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, t]);

  function isApiKeyValid(value: string): boolean {
    return value.startsWith(SENDGRID_API_KEY_PREFIX) && value.length >= SENDGRID_API_KEY_MIN_LENGTH;
  }

  async function handleTest() {
    if (!isApiKeyValid(apiKey)) {
      toast.error(t('settings.sendgridApiKeyInvalid'));
      return;
    }
    setTesting(true);
    try {
      const res = await accountSendgridGateway.test(accountId, apiKey);
      const accountSuffix = res.accountName ? ` (${res.accountName})` : '';
      toast.success(`${t('settings.sendgridTestOk')}${accountSuffix}`);
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('settings.sendgridTestError');
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isApiKeyValid(apiKey)) {
      toast.error(t('settings.sendgridApiKeyInvalid'));
      return;
    }
    setSaving(true);
    try {
      const next = await accountSendgridGateway.save(accountId, { apiKey });
      setStored(next);
      setApiKey('');
      toast.success(t('settings.sendgridSaveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('settings.sendgridSaveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (stored?.source !== 'account') return;
    setRemoving(true);
    try {
      await accountSendgridGateway.remove(accountId);
      const refreshed = await accountSendgridGateway.get(accountId);
      setStored(refreshed);
      toast.success(t('settings.sendgridDeleteOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('settings.sendgridDeleteError');
      toast.error(msg);
    } finally {
      setRemoving(false);
    }
  }

  function handleCopyWebhook() {
    if (!stored?.webhookUrl) return;
    navigator.clipboard.writeText(stored.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  const busy = testing || saving || removing;
  const canTest = isApiKeyValid(apiKey) && !busy;
  const sourceLabel =
    stored?.source === 'account' ? t('settings.sendgridSourceAccount') : t('settings.sendgridSourceNone');

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-4">
      <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 p-3 text-xs dark:bg-blue-950/30">
        <p className="font-medium text-blue-900 dark:text-blue-200">
          {t('settings.sendgridScopeTitle')}
        </p>
        <p className="mt-1 text-blue-800 dark:text-blue-300">
          {t('settings.sendgridScopeNote')}
        </p>
      </div>

      <div className="bg-muted rounded-md p-3 text-xs">
        <p className="font-medium">{t('settings.sendgridSourceLabel')}</p>
        <p className="text-muted-foreground mt-1">{sourceLabel}</p>
      </div>

      {stored?.source === 'account' && stored.apiKeyMasked && (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="text-xs font-medium">{t('settings.sendgridStoredLabel')}</p>
            <p className="text-muted-foreground font-mono text-sm">{stored.apiKeyMasked}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            {t('common.remove')}
          </Button>
        </div>
      )}

      {stored?.webhookUrl && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('settings.sendgridWebhook')}</Label>
          <div className="flex items-center gap-2">
            <Input value={stored.webhookUrl} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" size="sm" onClick={handleCopyWebhook}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{t('settings.sendgridWebhookHelp')}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-sg-apikey">
          {stored?.source === 'account' ? t('settings.sendgridReplaceApiKey') : t('settings.sendgridApiKey')}
        </Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id="account-sg-apikey"
              type={showApiKey ? 'text' : 'password'}
              placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={busy}
              className="pr-10"
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              aria-label={showApiKey ? 'Ocultar' : 'Mostrar'}
              onClick={() => setShowApiKey((v) => !v)}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="button" variant="secondary" disabled={!canTest} onClick={handleTest}>
            {testing ? t('settings.sendgridTesting') : t('settings.sendgridTest')}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{t('settings.sendgridApiKeyHelp')}</p>
      </div>

      <Button type="submit" disabled={busy || !isApiKeyValid(apiKey)}>
        {saving ? t('common.loading') : t('settings.sendgridSaveAndRegister')}
      </Button>
    </form>
  );
}
