import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/features/feature-flags/api';
import { whatsappMetaGateway, type WhatsappMetaAdminSettings } from './whatsapp-meta-gateway';

const META_WEBHOOK_EVENTS = ['messages', 'message_template_status_update', 'message_template_quality_update', 'message_template_components_update', 'account_update'];

function buildWebhookUrl(bmsPublicUrl: string | undefined): string {
  if (!bmsPublicUrl) return '';
  return `${bmsPublicUrl.replace(/\/+$/, '')}/webhooks/meta`;
}

/**
 * Wave 7.8 — Meta App credentials configuration (WhatsApp Cloud direct mode).
 *
 * Mirrors SendgridPlatformTab visually and behaviourally: form with masked
 * existing values, secret toggle, save button. No test-connection action
 * for now — the credentials are validated implicitly when an account tries
 * to connect a channel (Wave 7.4).
 */
export function WhatsappMetaTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<WhatsappMetaAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [configId, setConfigId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [graphVersion, setGraphVersion] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappMetaGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          setAppId(data.appId ?? '');
          setConfigId(data.configId ?? '');
          setGraphVersion(data.graphVersion ?? 'v18.0');
        } else {
          setGraphVersion('v18.0');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('integrations.whatsappMeta.loadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasSecret = !!settings?.appSecretMasked;
  const hasVerifyToken = !!settings?.verifyTokenMasked;
  const isValid = !!appId && !!configId && (hasSecret || !!appSecret) && (hasVerifyToken || !!verifyToken);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const updated = await whatsappMetaGateway.save({
        appId,
        configId,
        ...(appSecret ? { appSecret } : {}),
        ...(verifyToken ? { verifyToken } : {}),
        ...(graphVersion ? { graphVersion } : {}),
      });
      setSettings(updated);
      setAppSecret('');
      setVerifyToken('');
      toast.success(t('integrations.whatsappMeta.saveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('integrations.whatsappMeta.saveError');
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

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-6">
      <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-xs dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">{t('integrations.whatsappMeta.scopeTitle')}</p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">{t('integrations.whatsappMeta.scopeNote')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-meta-app-id">{t('integrations.whatsappMeta.appId')}</Label>
        <Input id="wa-meta-app-id" autoComplete="off" placeholder="1234567890123456" value={appId} onChange={(e) => setAppId(e.target.value)} disabled={saving} />
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.appIdHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-meta-app-secret">{t('integrations.whatsappMeta.appSecret')}</Label>
        {hasSecret && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('integrations.whatsappMeta.appSecretStored')}: </span>
            <span className="font-mono">{settings?.appSecretMasked}</span>
          </div>
        )}
        <div className="relative">
          <Input
            id="wa-meta-app-secret"
            type={showSecret ? 'text' : 'password'}
            placeholder={hasSecret ? t('integrations.whatsappMeta.appSecretReplace') : '32-char hex'}
            autoComplete="off"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            disabled={saving}
            className="pr-10"
          />
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
            onClick={() => setShowSecret((v) => !v)}
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.appSecretHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-meta-config-id">{t('integrations.whatsappMeta.configId')}</Label>
        <Input id="wa-meta-config-id" autoComplete="off" placeholder="9876543210987654" value={configId} onChange={(e) => setConfigId(e.target.value)} disabled={saving} />
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.configIdHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-meta-verify-token">{t('integrations.whatsappMeta.verifyToken')}</Label>
        {hasVerifyToken && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('integrations.whatsappMeta.verifyTokenStored')}: </span>
            <span className="font-mono">{settings?.verifyTokenMasked}</span>
          </div>
        )}
        <div className="relative">
          <Input
            id="wa-meta-verify-token"
            type={showVerifyToken ? 'text' : 'password'}
            placeholder={hasVerifyToken ? t('integrations.whatsappMeta.verifyTokenReplace') : 'random string (≥ 8 chars)'}
            autoComplete="off"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            disabled={saving}
            className="pr-10"
          />
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            aria-label={showVerifyToken ? 'Ocultar' : 'Mostrar'}
            onClick={() => setShowVerifyToken((v) => !v)}
          >
            {showVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.verifyTokenHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-meta-graph-version">{t('integrations.whatsappMeta.graphVersion')}</Label>
        <Input id="wa-meta-graph-version" placeholder="v18.0" value={graphVersion} onChange={(e) => setGraphVersion(e.target.value)} disabled={saving} />
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.graphVersionHelp')}</p>
      </div>

      <div>
        <Button type="submit" disabled={saving || !isValid}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      <WebhookSetupGuide />
    </form>
  );
}

function WebhookSetupGuide() {
  const { t } = useTranslation();
  const { data: flags } = useFeatureFlags();
  const webhookUrl = buildWebhookUrl(flags?.bms_public_url);
  const hasPublicUrl = !!webhookUrl;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('common.copyFailed'));
    }
  }

  return (
    <div className="border-border space-y-4 rounded-md border bg-blue-50/40 p-4 dark:bg-blue-950/20">
      <header className="space-y-1">
        <p className="text-sm font-medium">{t('integrations.whatsappMeta.guide.title')}</p>
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.guide.intro')}</p>
      </header>

      <div className="space-y-2">
        <Label className="text-xs">{t('integrations.whatsappMeta.guide.webhookUrlLabel')}</Label>
        {hasPublicUrl ? (
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 truncate rounded px-2 py-1.5 text-xs">{webhookUrl}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(webhookUrl)}>
              <Copy className="mr-1.5 h-3 w-3" />
              {t('common.copy')}
            </Button>
          </div>
        ) : (
          <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">{t('integrations.whatsappMeta.guide.missingPublicUrlTitle')}</p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">{t('integrations.whatsappMeta.guide.missingPublicUrlBody')}</p>
          </div>
        )}
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.guide.webhookUrlHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t('integrations.whatsappMeta.guide.verifyTokenLabel')}</Label>
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappMeta.guide.verifyTokenHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t('integrations.whatsappMeta.guide.eventsLabel')}</Label>
        <ul className="text-muted-foreground space-y-1 text-xs">
          {META_WEBHOOK_EVENTS.map((event) => (
            <li key={event} className="flex items-baseline gap-2">
              <code className="bg-muted rounded px-1.5 py-0.5 text-[11px]">{event}</code>
              <span>{t(`integrations.whatsappMeta.guide.eventDescriptions.${event}` as never)}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs italic">{t('integrations.whatsappMeta.guide.eventsHelp')}</p>
      </div>

      <p className="text-muted-foreground border-border border-t pt-3 text-xs">{t('integrations.whatsappMeta.guide.steps')}</p>
    </div>
  );
}
