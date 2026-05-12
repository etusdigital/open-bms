import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountId } from '../use-settings';
import { accountSesGateway, type AccountSesSettings } from './amazon-ses-account-gateway';
import { classifyProviderError, mapProviderError } from './provider-error-toast';

const TEST_RATE_LIMIT_COOLDOWN_SECONDS = 60;

const SES_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'eu-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'me-south-1',
] as const;

const AWS_ACCESS_KEY_PATTERN = /^(AKIA|ASIA)[A-Z0-9]{16}$/;
const AWS_SECRET_KEY_MIN_LENGTH = 40;

interface AmazonSesCardProps {
  onChange?: () => void;
  id?: string;
  isDefault?: boolean;
  onAttemptRemoveDefault?: () => void;
}

export function AmazonSesCard({ onChange, id, isDefault, onAttemptRemoveDefault }: AmazonSesCardProps) {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const [stored, setStored] = useState<AccountSesSettings | null>(null);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [region, setRegion] = useState<string>(SES_REGIONS[0]);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testCooldownSeconds, setTestCooldownSeconds] = useState(0);

  useEffect(() => {
    if (testCooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setTestCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [testCooldownSeconds]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    accountSesGateway
      .get(accountId)
      .then((value) => {
        if (cancelled) return;
        setStored(value);
        if (value.region) setRegion(value.region);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(mapProviderError(err, 'Amazon SES'));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, t]);

  function isFormValid(): boolean {
    return (
      AWS_ACCESS_KEY_PATTERN.test(accessKeyId) &&
      secretAccessKey.length >= AWS_SECRET_KEY_MIN_LENGTH &&
      (SES_REGIONS as readonly string[]).includes(region)
    );
  }

  async function handleTest() {
    if (!isFormValid()) {
      toast.error(t('settings.sesApiKeyInvalid'));
      return;
    }
    setTesting(true);
    try {
      const res = await accountSesGateway.test(accountId, { accessKeyId, secretAccessKey, region });
      if (res.ok) {
        toast.success(t('settings.sesTestOk'));
      } else if (res.errorMessage && res.errorMessage.includes('SendingEnabled=false')) {
        toast.warning(t('settings.sesSandboxToast'));
      } else {
        toast.error(res.errorMessage || mapProviderError(undefined, 'Amazon SES'));
      }
    } catch (err) {
      if (classifyProviderError(err, 'Amazon SES') === 'rate-limited') {
        setTestCooldownSeconds(TEST_RATE_LIMIT_COOLDOWN_SECONDS);
      }
      toast.error(mapProviderError(err, 'Amazon SES'));
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isFormValid()) {
      toast.error(t('settings.sesApiKeyInvalid'));
      return;
    }
    setSaving(true);
    try {
      const next = await accountSesGateway.save(accountId, { accessKeyId, secretAccessKey, region });
      setStored(next);
      setAccessKeyId('');
      setSecretAccessKey('');
      toast.success(t('settings.sesSaveOk'));
      onChange?.();
    } catch (err) {
      toast.error(mapProviderError(err, 'Amazon SES'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (stored?.source !== 'account') return;
    if (isDefault && onAttemptRemoveDefault) {
      onAttemptRemoveDefault();
      return;
    }
    setRemoving(true);
    try {
      await accountSesGateway.remove(accountId);
      const refreshed = await accountSesGateway.get(accountId);
      setStored(refreshed);
      setRegion(refreshed.region ?? SES_REGIONS[0]);
      toast.success(t('settings.sesDeleteOk'));
      onChange?.();
    } catch (err) {
      toast.error(mapProviderError(err, 'Amazon SES'));
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const busy = testing || saving || removing;
  const canTest = isFormValid() && !busy && testCooldownSeconds === 0;
  const sourceLabel = stored?.source === 'account' ? t('settings.sesSourceAccount') : t('settings.sesSourceNone');

  return (
    <form id={id} onSubmit={handleSubmit} noValidate className="max-w-lg space-y-4" data-testid="provider-card-ses">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Amazon SES</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                aria-label={t('settings.sesSandboxWarning')}
                data-testid="provider-card-ses-sandbox-tooltip"
                className="text-yellow-600 dark:text-yellow-400"
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('settings.sesSandboxWarning')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-muted-foreground ml-auto text-xs">{sourceLabel}</span>
      </div>

      {stored?.source === 'account' && (
        <div className="space-y-2 rounded-md border px-3 py-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{t('settings.sesAccessKeyId')}</p>
              <p className="text-muted-foreground font-mono text-sm">{stored.accessKeyIdMasked ?? '—'}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" />
              {t('common.remove')}
            </Button>
          </div>
          <div>
            <p className="text-xs font-medium">{t('settings.sesSecretAccessKey')}</p>
            <p className="text-muted-foreground font-mono text-sm">{stored.secretAccessKeyMasked ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium">{t('settings.sesRegion')}</p>
            <p className="text-muted-foreground font-mono text-sm">{stored.region ?? '—'}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-ses-access-key-id">{t('settings.sesAccessKeyId')}</Label>
        <Input
          id="account-ses-access-key-id"
          placeholder="AKIAxxxxxxxxxxxxxxxx"
          autoComplete="off"
          value={accessKeyId}
          onChange={(e) => setAccessKeyId(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-ses-secret-access-key">{t('settings.sesSecretAccessKey')}</Label>
        <div className="relative">
          <Input
            id="account-ses-secret-access-key"
            type={showSecret ? 'text' : 'password'}
            placeholder="••••••••••••••••••••••••••••••••••••••••"
            autoComplete="off"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            disabled={busy}
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-ses-region">{t('settings.sesRegion')}</Label>
        <Select value={region} onValueChange={setRegion} disabled={busy}>
          <SelectTrigger id="account-ses-region" className="w-full">
            <SelectValue placeholder={t('settings.sesRegion')} />
          </SelectTrigger>
          <SelectContent>
            {SES_REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!canTest}
          onClick={handleTest}
          data-testid="provider-card-ses-test"
        >
          {testing
            ? t('settings.sesTesting')
            : testCooldownSeconds > 0
              ? `Aguarde ${testCooldownSeconds}s`
              : t('settings.sesTest')}
        </Button>
        <Button type="submit" disabled={busy || !isFormValid()}>
          {saving ? t('common.loading') : t('settings.sesSave')}
        </Button>
      </div>
    </form>
  );
}
