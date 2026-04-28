import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { sendgridGateway } from './sendgrid-gateway';

const SENDGRID_API_KEY_PREFIX = 'SG.';
const SENDGRID_API_KEY_MIN_LENGTH = 10;

export function SendgridTab() {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sendgridGateway
      .getSendgrid()
      .then((value) => {
        if (cancelled) return;
        if (value) {
          setApiKey(value.apiKey ?? '');
          setWebhookBaseUrl(value.webhookBaseUrl ?? '');
        }
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
  }, [t]);

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
      const res = await sendgridGateway.testSendgrid(apiKey);
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
      await sendgridGateway.saveSendgrid({
        apiKey,
        ...(webhookBaseUrl.trim() && { webhookBaseUrl: webhookBaseUrl.trim() }),
      });
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

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  const busy = testing || saving;
  const canTest = isApiKeyValid(apiKey) && !busy;

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-sg-apikey">{t('settings.sendgridApiKey')}</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id="settings-sg-apikey"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-sg-webhook">{t('settings.sendgridWebhook')}</Label>
        <Input
          id="settings-sg-webhook"
          placeholder="https://app.empresa.com/bms/events"
          value={webhookBaseUrl}
          onChange={(e) => setWebhookBaseUrl(e.target.value)}
          disabled={busy}
        />
        <p className="text-muted-foreground text-xs">{t('settings.sendgridWebhookHelp')}</p>
      </div>

      <Button type="submit" disabled={busy || !isApiKeyValid(apiKey)}>
        {saving ? t('common.loading') : t('common.save')}
      </Button>
    </form>
  );
}
