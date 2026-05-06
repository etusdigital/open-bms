import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { emailableGateway, type EmailableAdminSettings } from './emailable-gateway';

const DEFAULT_URL = 'https://api.emailable.com/v1/verify';

export function EmailableTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<EmailableAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    emailableGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          setUrl(data.url ?? DEFAULT_URL);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('integrations.emailable.loadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasExistingKey = !!settings?.apiKeyMasked;
  const isValid = !!apiKey || hasExistingKey;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const updated = await emailableGateway.save({
        url: url || undefined,
        ...(apiKey ? { apiKey } : {}),
      });
      setSettings(updated);
      setApiKey('');
      toast.success(t('integrations.emailable.saveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.emailable.saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await emailableGateway.testConnection({
        url: url || undefined,
        ...(apiKey ? { apiKey } : {}),
      });
      if (result.ok) toast.success(t('integrations.emailable.testOk'));
      else toast.error(result.errorMessage ?? t('integrations.emailable.testError'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.emailable.testError');
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
      <div className="space-y-2">
        <Label htmlFor="em-url">{t('integrations.emailable.url')}</Label>
        <Input id="em-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={saving} />
        <p className="text-muted-foreground text-xs">{t('integrations.emailable.urlHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="em-key">{t('integrations.emailable.apiKey')}</Label>
        {hasExistingKey && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('integrations.emailable.apiKeyStored')}: </span>
            <span className="font-mono">{settings?.apiKeyMasked}</span>
          </div>
        )}
        <div className="relative">
          <Input
            id="em-key"
            type={showKey ? 'text' : 'password'}
            placeholder={hasExistingKey ? t('integrations.emailable.apiKeyReplace') : ''}
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={saving}
            className="pr-10"
          />
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            aria-label={showKey ? 'Ocultar' : 'Mostrar'}
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
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
