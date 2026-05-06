import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fcmGateway, type FcmAdminSettings } from './fcm-gateway';

export function FcmTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<FcmAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState('');

  useEffect(() => {
    let cancelled = false;
    fcmGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('integrations.fcm.loadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasExistingKey = !!settings?.hasPrivateKey;
  const isValid = !!serviceAccountJson || hasExistingKey;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const updated = await fcmGateway.save({
        ...(serviceAccountJson ? { serviceAccountJson } : {}),
      });
      setSettings(updated);
      setServiceAccountJson('');
      toast.success(t('integrations.fcm.saveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.fcm.saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await fcmGateway.testConnection({
        ...(serviceAccountJson ? { serviceAccountJson } : {}),
      });
      if (result.ok) toast.success(`${t('integrations.fcm.testOk')} (${result.projectId ?? '?'})`);
      else toast.error(result.errorMessage ?? t('integrations.fcm.testError'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.fcm.testError');
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-6">
      {settings && (
        <div className="bg-muted rounded-md px-3 py-2 text-xs space-y-1">
          <div>
            <span className="text-muted-foreground">{t('integrations.fcm.projectIdStored')}: </span>
            <span className="font-mono">{settings.projectId ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('integrations.fcm.clientEmailStored')}: </span>
            <span className="font-mono">{settings.clientEmail ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('integrations.fcm.privateKeyStored')}: </span>
            <span className="font-mono">{hasExistingKey ? '••••••••' : '—'}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fcm-json">{t('integrations.fcm.serviceAccountJson')}</Label>
        <textarea
          id="fcm-json"
          rows={10}
          className="w-full font-mono text-xs border rounded-md p-2 bg-background"
          placeholder={hasExistingKey ? t('integrations.fcm.serviceAccountJsonReplace') : '{"type":"service_account",...}'}
          value={serviceAccountJson}
          onChange={(e) => setServiceAccountJson(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.fcm.serviceAccountJsonHelp')}</p>
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
