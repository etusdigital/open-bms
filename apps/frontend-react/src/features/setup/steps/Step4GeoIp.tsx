import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';
import type {
  GeoIpSetupData,
  GeoIpSetupMode,
  GeoIpSetupProvider,
} from '@/features/setup/setup.types';

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

const PROVIDER_LABELS: Record<GeoIpSetupProvider, string> = {
  'dbip-full': 'DB-IP Full (subscriber API)',
  maxmind: 'MaxMind GeoLite2',
  'ip-api': 'ip-api.com Pro',
  ipinfo: 'ipinfo.io',
};

function buildPayload(
  mode: GeoIpSetupMode,
  provider: GeoIpSetupProvider,
  apiKey: string,
  accountId: string,
  licenseKey: string,
): GeoIpSetupData | null {
  if (mode === 'disabled') return { mode: 'disabled' };
  if (mode === 'lite') return { mode: 'lite' };
  if (provider === 'maxmind') {
    if (!accountId.trim() || !licenseKey.trim()) return null;
    return {
      mode: 'advanced',
      provider: 'maxmind',
      accountId: accountId.trim(),
      licenseKey: licenseKey.trim(),
    };
  }
  if (!apiKey.trim()) return null;
  return { mode: 'advanced', provider, apiKey: apiKey.trim() };
}

export function Step4GeoIp({ onComplete, onBack }: Props) {
  const [mode, setMode] = useState<GeoIpSetupMode>('lite');
  const [provider, setProvider] = useState<GeoIpSetupProvider>('dbip-full');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const payload = buildPayload(mode, provider, apiKey, accountId, licenseKey);
    if (!payload) {
      setError('Preencha as credenciais do provedor selecionado.');
      return;
    }

    setSubmitting(true);
    try {
      await setupGateway.submitGeoIp(payload);
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao salvar configuração de GeoIP.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-muted-foreground text-xs">
        Enriquecimento opcional de eventos com país, região e cidade a partir do IP.
        Pode ser alterado depois em Super Admin → GeoIP.
      </p>

      <div className="flex flex-col gap-2">
        <ModeOption
          checked={mode === 'lite'}
          onChange={() => setMode('lite')}
          title="Banco gratuito (DB-IP Lite)"
          description="Banco local CC-BY 4.0, atualização mensal automática. Não exige cadastro."
          attribution
        />
        <ModeOption
          checked={mode === 'advanced'}
          onChange={() => setMode('advanced')}
          title="Avançado (provedor com chave própria)"
          description="DB-IP Full, MaxMind GeoLite2 ou API remota (ip-api / ipinfo)."
        />
        <ModeOption
          checked={mode === 'disabled'}
          onChange={() => setMode('disabled')}
          title="Desativado"
          description="Eventos serão registrados sem enriquecimento de país/cidade."
        />
      </div>

      {mode === 'advanced' && (
        <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setup-geoip-provider">Provedor</Label>
            <select
              id="setup-geoip-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as GeoIpSetupProvider)}
              disabled={submitting}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {(Object.keys(PROVIDER_LABELS) as GeoIpSetupProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {provider === 'maxmind' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-geoip-account">Account ID</Label>
                <Input
                  id="setup-geoip-account"
                  inputMode="numeric"
                  pattern="\d+"
                  placeholder="123456"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="setup-geoip-license">License Key</Label>
                <Input
                  id="setup-geoip-license"
                  type="password"
                  autoComplete="off"
                  placeholder="••••••••"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="setup-geoip-key">API Key</Label>
              <Input
                id="setup-geoip-key"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" disabled={submitting} onClick={onBack}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
    </form>
  );
}

function ModeOption({
  checked,
  onChange,
  title,
  description,
  attribution,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
  attribution?: boolean;
}) {
  return (
    <label
      className={
        'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ' +
        (checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')
      }
    >
      <input
        type="radio"
        className="mt-1"
        checked={checked}
        onChange={onChange}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
        {attribution && checked && (
          <span className="text-muted-foreground mt-1 text-[10px]">
            IP geolocation by{' '}
            <a
              href="https://db-ip.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              DB-IP.com
            </a>{' '}
            — licenciado sob CC-BY 4.0.
          </span>
        )}
      </div>
    </label>
  );
}
