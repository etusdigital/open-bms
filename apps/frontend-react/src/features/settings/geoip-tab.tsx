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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  geoIpSettingsGateway,
  type GeoIpAdminSettings,
  type GeoIpMode,
  type GeoIpProvider,
} from './geoip-settings-gateway';

const API_KEY_PROVIDERS: GeoIpProvider[] = ['dbip-full', 'ip-api', 'ipinfo'];

export function GeoIpTab() {
  const { t } = useTranslation();

  const [settings, setSettings] = useState<GeoIpAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<GeoIpMode>('lite');
  const [provider, setProvider] = useState<GeoIpProvider | ''>('');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showLicenseKey, setShowLicenseKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    geoIpSettingsGateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          setMode(data.mode);
          setProvider(data.provider ?? '');
          if (data.accountId) setAccountId(data.accountId);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : t('settings.geoipLoadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function handleProviderChange(p: GeoIpProvider) {
    setProvider(p);
    // Clear credential fields when switching providers — user must re-enter.
    setApiKey('');
    setAccountId('');
    setLicenseKey('');
  }

  // Whether existing credentials cover the current provider (so leaving the
  // field blank is valid — the backend will merge the existing value).
  function hasExistingApiKey(): boolean {
    return settings?.provider === provider && !!settings?.apiKeyMasked;
  }
  function hasExistingAccountId(): boolean {
    return settings?.provider === provider && !!settings?.accountId;
  }
  function hasExistingLicenseKey(): boolean {
    return settings?.provider === provider && !!settings?.hasLicenseKey;
  }

  function isValid(): boolean {
    if (mode !== 'advanced') return true;
    if (!provider) return false;
    if (API_KEY_PROVIDERS.includes(provider as GeoIpProvider)) {
      return !!(apiKey || hasExistingApiKey());
    }
    if (provider === 'maxmind') {
      return (
        !!(accountId || hasExistingAccountId()) &&
        !!(licenseKey || hasExistingLicenseKey())
      );
    }
    return true;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid()) return;
    setSaving(true);
    try {
      const payload: Parameters<typeof geoIpSettingsGateway.save>[0] = { mode };
      if (mode === 'advanced') {
        payload.provider = provider as GeoIpProvider;
        if (apiKey) payload.apiKey = apiKey;
        if (accountId) payload.accountId = accountId;
        if (licenseKey) payload.licenseKey = licenseKey;
      }
      const updated = await geoIpSettingsGateway.save(payload);
      setSettings(updated);
      // Refresh form state from the saved response
      setMode(updated.mode);
      setProvider(updated.provider ?? '');
      if (updated.accountId) setAccountId(updated.accountId);
      // Clear secret fields — masked values will show on next load
      setApiKey('');
      setLicenseKey('');
      toast.success(t('settings.geoipSaveOk'));
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('settings.geoipSaveError');
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

  const usesApiKey = mode === 'advanced' && provider && API_KEY_PROVIDERS.includes(provider as GeoIpProvider);
  const usesMaxMind = mode === 'advanced' && provider === 'maxmind';

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-lg space-y-6">
      {/* Mode */}
      <div className="space-y-2">
        <Label>{t('settings.geoipModeLabel')}</Label>
        <div className="flex gap-2">
          {(['disabled', 'lite', 'advanced'] as GeoIpMode[]).map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode(m)}
            >
              {t(`settings.geoipMode${m.charAt(0).toUpperCase() + m.slice(1)}` as never)}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {t(`settings.geoipMode${mode.charAt(0).toUpperCase() + mode.slice(1)}Help` as never)}
        </p>
      </div>

      {/* Provider select */}
      {mode === 'advanced' && (
        <div className="space-y-2">
          <Label>{t('settings.geoipProviderLabel')}</Label>
          <Select
            value={provider}
            onValueChange={(v) => handleProviderChange(v as GeoIpProvider)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.select')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dbip-full">{t('settings.geoipProviderDbipFull')}</SelectItem>
              <SelectItem value="maxmind">{t('settings.geoipProviderMaxmind')}</SelectItem>
              <SelectItem value="ip-api">{t('settings.geoipProviderIpApi')}</SelectItem>
              <SelectItem value="ipinfo">{t('settings.geoipProviderIpinfo')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API Key (dbip-full, ip-api, ipinfo) */}
      {usesApiKey && (
        <div className="space-y-2">
          <Label htmlFor="geoip-apikey">{t('settings.geoipApiKey')}</Label>
          {hasExistingApiKey() && (
            <div className="bg-muted rounded-md px-3 py-2 text-xs">
              <span className="text-muted-foreground">{t('settings.geoipApiKeyStored')}: </span>
              <span className="font-mono">{settings?.apiKeyMasked}</span>
            </div>
          )}
          <div className="relative">
            <Input
              id="geoip-apikey"
              type={showApiKey ? 'text' : 'password'}
              placeholder={hasExistingApiKey() ? t('settings.geoipApiKeyReplace') : ''}
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
          <p className="text-muted-foreground text-xs">{t('settings.geoipApiKeyHelp')}</p>
        </div>
      )}

      {/* MaxMind credentials */}
      {usesMaxMind && (
        <>
          <div className="space-y-2">
            <Label htmlFor="geoip-accountid">{t('settings.geoipAccountId')}</Label>
            <Input
              id="geoip-accountid"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={saving}
            />
            <p className="text-muted-foreground text-xs">{t('settings.geoipAccountIdHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="geoip-licensekey">{t('settings.geoipLicenseKey')}</Label>
            {hasExistingLicenseKey() && (
              <div className="bg-muted rounded-md px-3 py-2 text-xs">
                <span className="text-muted-foreground">{t('settings.geoipLicenseKeyStored')}: </span>
                <span className="font-mono">••••••••</span>
              </div>
            )}
            <div className="relative">
              <Input
                id="geoip-licensekey"
                type={showLicenseKey ? 'text' : 'password'}
                placeholder={hasExistingLicenseKey() ? t('settings.geoipLicenseKeyReplace') : ''}
                autoComplete="off"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={saving}
                className="pr-10"
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                aria-label={showLicenseKey ? 'Ocultar' : 'Mostrar'}
                onClick={() => setShowLicenseKey((v) => !v)}
              >
                {showLicenseKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">{t('settings.geoipLicenseKeyHelp')}</p>
          </div>
        </>
      )}

      <Button type="submit" disabled={saving || !isValid()}>
        {saving ? t('common.loading') : t('common.save')}
      </Button>
    </form>
  );
}
