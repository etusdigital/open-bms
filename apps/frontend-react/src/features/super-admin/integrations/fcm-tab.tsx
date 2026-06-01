import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fcmGateway, type FcmAdminSettings } from './fcm-gateway';

// Accepts what the Firebase console hands you — either strict JSON or the JS
// object literal `const firebaseConfig = { apiKey: "...", ... }`. Returns a flat
// string map of the known web-config keys, or null if it can't be parsed.
const WEB_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
function parseFirebaseConfig(input: string): Record<string, string> | null {
  // Isolate the object literal if the user pasted the whole `const ... = {...};`.
  const braceMatch = input.match(/\{[\s\S]*\}/);
  const objText = braceMatch ? braceMatch[0] : input;
  let parsed: any = null;
  try {
    parsed = JSON.parse(objText);
  } catch {
    try {
      // Tolerate unquoted keys / trailing commas from the JS literal form.
       
      parsed = Function(`"use strict";return (${objText});`)();
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const out: Record<string, string> = {};
  for (const k of WEB_CONFIG_KEYS) {
    if (parsed[k] != null) out[k] = String(parsed[k]);
  }
  return Object.keys(out).length ? out : null;
}

export function FcmTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<FcmAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  // Web-push platform config: paste the Firebase `firebaseConfig` object + VAPID.
  const [webConfigText, setWebConfigText] = useState('');
  const [vapidKey, setVapidKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    fcmGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          if (data.webConfig) setWebConfigText(JSON.stringify(data.webConfig, null, 2));
          if (data.vapidPublicKey) setVapidKey(data.vapidPublicKey);
        }
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
    let webConfig: Record<string, string> | undefined;
    if (webConfigText.trim()) {
      webConfig = parseFirebaseConfig(webConfigText);
      if (!webConfig) {
        toast.error(t('integrations.fcm.webConfigInvalid') ?? 'Firebase web config inválido. Cole o objeto firebaseConfig do console.');
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await fcmGateway.save({
        ...(serviceAccountJson ? { serviceAccountJson } : {}),
        ...(webConfig ? { webConfig } : {}),
        ...(vapidKey.trim() ? { vapidPublicKey: vapidKey.trim() } : {}),
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

      <div className="space-y-2 border-t pt-6">
        <h4 className="text-sm font-medium">{t('integrations.fcm.webPushTitle') ?? 'Web-Push (registro no navegador)'}</h4>
        <p className="text-muted-foreground text-xs">
          {t('integrations.fcm.webPushHelp') ??
            'Config Firebase web + VAPID da PLATAFORMA (mesmo projeto do service account acima). Usadas para gerar o service worker que os sites das contas registram. Valores públicos (client-side).'}
        </p>
        <Label htmlFor="fcm-web-config">{t('integrations.fcm.webConfig') ?? 'Firebase Web Config'}</Label>
        <textarea
          id="fcm-web-config"
          rows={8}
          className="w-full font-mono text-xs border rounded-md p-2 bg-background"
          placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  messagingSenderId: "...",\n  appId: "..."\n};'}
          value={webConfigText}
          onChange={(e) => setWebConfigText(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.fcm.webConfigHelp') ?? 'Cole o objeto firebaseConfig do Firebase Console → Project settings → Your apps → Web app.'}</p>

        <Label htmlFor="fcm-vapid">{t('integrations.fcm.vapidKey') ?? 'VAPID Public Key'}</Label>
        <input
          id="fcm-vapid"
          className="w-full font-mono text-xs border rounded-md p-2 bg-background"
          placeholder="BICh…"
          value={vapidKey}
          onChange={(e) => setVapidKey(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.fcm.vapidKeyHelp') ?? 'Firebase Console → Cloud Messaging → Web Push certificates → Generate key pair.'}</p>
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
