import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  sendgridPlatformGateway,
  type SendgridPlatformAdminSettings,
} from './sendgrid-platform-gateway';

export function SendgridPlatformTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SendgridPlatformAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [webhookUrlBase, setWebhookUrlBase] = useState('');
  const [ipPool, setIpPool] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sendgridPlatformGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          setApiBaseUrl(data.apiBaseUrl ?? '');
          setWebhookUrlBase(data.webhookUrlBase ?? '');
          setIpPool(data.ipPool ?? '');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('integrations.sendgridPlatform.loadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasExistingApiKey = !!settings?.apiKeyMasked;
  const isValid = !!apiKey || hasExistingApiKey;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        ...(apiKey ? { apiKey } : {}),
        apiBaseUrl: apiBaseUrl || undefined,
        webhookUrlBase: webhookUrlBase || undefined,
        ipPool: ipPool || undefined,
      };
      const updated = await sendgridPlatformGateway.save(payload);
      setSettings(updated);
      setApiKey('');
      toast.success(t('integrations.sendgridPlatform.saveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.sendgridPlatform.saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await sendgridPlatformGateway.testConnection({
        ...(apiKey ? { apiKey } : {}),
        apiBaseUrl: apiBaseUrl || undefined,
      });
      if (result.ok) {
        const account = result.accountName ? ` (${result.accountName})` : '';
        toast.success(t('integrations.sendgridPlatform.testOk') + account);
      } else {
        toast.error(result.errorMessage ?? t('integrations.sendgridPlatform.testError'));
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.sendgridPlatform.testError');
      toast.error(msg);
    } finally {
      setTesting(false);
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

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-6">
      <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-xs dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {t('integrations.sendgridPlatform.scopeTitle')}
        </p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">
          {t('integrations.sendgridPlatform.scopeNote')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sg-apikey">{t('integrations.sendgridPlatform.apiKey')}</Label>
        {hasExistingApiKey && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {t('integrations.sendgridPlatform.apiKeyStored')}:{' '}
            </span>
            <span className="font-mono">{settings?.apiKeyMasked}</span>
          </div>
        )}
        <div className="relative">
          <Input
            id="sg-apikey"
            type={showApiKey ? 'text' : 'password'}
            placeholder={hasExistingApiKey ? t('integrations.sendgridPlatform.apiKeyReplace') : 'SG.xxxxx'}
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={saving}
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
        <p className="text-muted-foreground text-xs">{t('integrations.sendgridPlatform.apiKeyHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sg-base">{t('integrations.sendgridPlatform.apiBaseUrl')}</Label>
        <Input
          id="sg-base"
          placeholder="https://api.sendgrid.com"
          value={apiBaseUrl}
          onChange={(e) => setApiBaseUrl(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.sendgridPlatform.apiBaseUrlHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sg-webhook">{t('integrations.sendgridPlatform.webhookUrlBase')}</Label>
        <Input
          id="sg-webhook"
          placeholder="https://events.example.com/sendgrid"
          value={webhookUrlBase}
          onChange={(e) => setWebhookUrlBase(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.sendgridPlatform.webhookUrlBaseHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sg-pool">{t('integrations.sendgridPlatform.ipPool')}</Label>
        <Input
          id="sg-pool"
          value={ipPool}
          onChange={(e) => setIpPool(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.sendgridPlatform.ipPoolHelp')}</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !isValid}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !isValid}>
          {testing ? t('common.loading') : t('integrations.testConnection')}
        </Button>
      </div>
    </form>
  );
}
