import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { whatsappHubGateway, type WhatsappHubAdminSettings } from './whatsapp-hub-gateway';

/**
 * Wave 7.8 — EvoHub credentials + master `enabled` toggle.
 *
 * The toggle is the source of truth for the install-wide WhatsApp mode
 * (read at boot by WhatsappModeResolverService via EVOLUTION_HUB_ENABLED).
 * Flipping it requires a msgops-api restart for the env file to be re-read.
 */
export function WhatsappHubTab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<WhatsappHubAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappHubGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          setEnabled(data.enabled);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('integrations.whatsappHub.loadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasApiKey = !!settings?.apiKeyMasked;
  const hasSecret = !!settings?.webhookSecretMasked;
  // Validation only enforced when enabling; turning it OFF should always be allowed.
  const isValid = !enabled || ((hasApiKey || !!apiKey) && (hasSecret || !!webhookSecret));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const updated = await whatsappHubGateway.save({
        enabled,
        ...(apiKey ? { apiKey } : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
      });
      setSettings(updated);
      setApiKey('');
      setWebhookSecret('');
      toast.success(t('integrations.whatsappHub.saveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('integrations.whatsappHub.saveError');
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
        <p className="font-medium text-amber-900 dark:text-amber-200">{t('integrations.whatsappHub.scopeTitle')}</p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">{t('integrations.whatsappHub.scopeNote')}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="wa-hub-enabled" className="text-base">
            {t('integrations.whatsappHub.enabled')}
          </Label>
          <p className="text-muted-foreground text-xs">{t('integrations.whatsappHub.enabledHelp')}</p>
        </div>
        <Switch id="wa-hub-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-hub-api-key">{t('integrations.whatsappHub.apiKey')}</Label>
        {hasApiKey && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('integrations.whatsappHub.apiKeyStored')}: </span>
            <span className="font-mono">{settings?.apiKeyMasked}</span>
          </div>
        )}
        <div className="relative">
          <Input
            id="wa-hub-api-key"
            type={showApiKey ? 'text' : 'password'}
            placeholder={hasApiKey ? t('integrations.whatsappHub.apiKeyReplace') : 'eh_...'}
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
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappHub.apiKeyHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa-hub-webhook-secret">{t('integrations.whatsappHub.webhookSecret')}</Label>
        {hasSecret && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('integrations.whatsappHub.webhookSecretStored')}: </span>
            <span className="font-mono">{settings?.webhookSecretMasked}</span>
          </div>
        )}
        <div className="relative">
          <Input
            id="wa-hub-webhook-secret"
            type={showSecret ? 'text' : 'password'}
            placeholder={hasSecret ? t('integrations.whatsappHub.webhookSecretReplace') : '16+ chars'}
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
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
        <p className="text-muted-foreground text-xs">{t('integrations.whatsappHub.webhookSecretHelp')}</p>
      </div>

      <div>
        <Button type="submit" disabled={saving || !isValid}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      <HubAutoSetupNote />
    </form>
  );
}

function HubAutoSetupNote() {
  const { t } = useTranslation();
  return (
    <div className="border-border space-y-2 rounded-md border bg-blue-50/40 p-4 dark:bg-blue-950/20">
      <p className="text-sm font-medium">{t('integrations.whatsappHub.guide.title')}</p>
      <p className="text-muted-foreground text-xs">{t('integrations.whatsappHub.guide.body')}</p>
      <p className="text-muted-foreground text-xs">{t('integrations.whatsappHub.guide.publicUrlReminder')}</p>
    </div>
  );
}
