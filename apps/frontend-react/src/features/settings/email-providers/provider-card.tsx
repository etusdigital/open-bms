import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAccountId } from '../use-settings';
import { classifyProviderError, mapProviderError } from './provider-error-toast';

// Matches the backend per-IP rate limit window for /settings/:provider/test (TEST_RATE_WINDOW_MS).
const TEST_RATE_LIMIT_COOLDOWN_SECONDS = 60;

export interface ProviderCardApiKeyConfig {
  placeholder: string;
  prefix?: string;
  minLength: number;
  helperText: string;
  validate?: (value: string) => boolean;
}

export interface ProviderCardGateway {
  get: (accountId: number) => Promise<{ source: 'account' | 'none'; apiKeyMasked: string | null }>;
  save: (
    accountId: number,
    payload: { apiKey: string },
  ) => Promise<{ source: 'account' | 'none'; apiKeyMasked: string | null }>;
  remove: (accountId: number) => Promise<void>;
  test: (accountId: number, apiKey: string) => Promise<{ ok: boolean; errorMessage?: string }>;
}

export interface ProviderCardBanner {
  variant: 'warning' | 'info';
  text: ReactNode;
}

export interface ProviderCardProps {
  providerName: string;
  providerLabel: string;
  apiKeyConfig: ProviderCardApiKeyConfig;
  gateway: ProviderCardGateway;
  banner?: ProviderCardBanner;
  onChange?: () => void;
  /** Optional content rendered below the inputs (e.g. SendGrid webhook URL). */
  footerSlot?: ReactNode;
  /** DOM id applied to the card root — used by the first-time wizard to scroll/focus a chosen card. */
  id?: string;
  /**
   * Invoked when the user tries to remove this card while it is the current default provider.
   * When provided, the gateway.remove call is suppressed and the parent is expected to surface
   * a confirm dialog that lets the user pick a replacement default (RemoveDefaultConfirmDialog).
   */
  onAttemptRemoveDefault?: () => void;
  /** Whether this card's provider is the current default. Drives the remove-default intercept. */
  isDefault?: boolean;
}

interface StoredView {
  source: 'account' | 'none';
  apiKeyMasked: string | null;
}

export function ProviderCard({
  providerName,
  providerLabel,
  apiKeyConfig,
  gateway,
  banner,
  onChange,
  footerSlot,
  id,
  onAttemptRemoveDefault,
  isDefault,
}: ProviderCardProps) {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const [stored, setStored] = useState<StoredView | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
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
    gateway
      .get(accountId)
      .then((value) => {
        if (cancelled) return;
        setStored(value);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(mapProviderError(err, providerLabel));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, gateway, providerLabel]);

  function isApiKeyValid(value: string): boolean {
    if (apiKeyConfig.validate) return apiKeyConfig.validate(value);
    if (apiKeyConfig.prefix && !value.startsWith(apiKeyConfig.prefix)) return false;
    return value.length >= apiKeyConfig.minLength;
  }

  async function handleTest() {
    if (!isApiKeyValid(apiKey)) {
      toast.error(t(`settings.${providerName}ApiKeyInvalid` as never));
      return;
    }
    setTesting(true);
    try {
      const res = await gateway.test(accountId, apiKey);
      if (res.ok) {
        toast.success(t(`settings.${providerName}TestOk` as never));
      } else {
        toast.error(res.errorMessage || mapProviderError(undefined, providerLabel));
      }
    } catch (err) {
      if (classifyProviderError(err, providerLabel) === 'rate-limited') {
        setTestCooldownSeconds(TEST_RATE_LIMIT_COOLDOWN_SECONDS);
      }
      toast.error(mapProviderError(err, providerLabel));
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isApiKeyValid(apiKey)) {
      toast.error(t(`settings.${providerName}ApiKeyInvalid` as never));
      return;
    }
    setSaving(true);
    try {
      const next = await gateway.save(accountId, { apiKey });
      setStored(next);
      setApiKey('');
      toast.success(t(`settings.${providerName}SaveOk` as never));
      onChange?.();
    } catch (err) {
      toast.error(mapProviderError(err, providerLabel));
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
      await gateway.remove(accountId);
      const refreshed = await gateway.get(accountId);
      setStored(refreshed);
      toast.success(t(`settings.${providerName}DeleteOk` as never));
      onChange?.();
    } catch (err) {
      toast.error(mapProviderError(err, providerLabel));
    } finally {
      setRemoving(false);
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

  const busy = testing || saving || removing;
  const canTest = isApiKeyValid(apiKey) && !busy && testCooldownSeconds === 0;
  const sourceLabel =
    stored?.source === 'account'
      ? t(`settings.${providerName}SourceAccount` as never)
      : t(`settings.${providerName}SourceNone` as never);

  return (
    <form id={id} onSubmit={handleSubmit} noValidate className="max-w-lg space-y-4" data-testid={`provider-card-${providerName}`}>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">{providerLabel}</h3>
        {banner && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={typeof banner.text === 'string' ? banner.text : undefined}
                  data-testid={`provider-card-${providerName}-banner`}
                  className={
                    banner.variant === 'warning'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }
                >
                  {banner.variant === 'warning' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{banner.text}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="text-muted-foreground ml-auto text-xs">{sourceLabel as string}</span>
      </div>

      {stored?.source === 'account' && stored.apiKeyMasked && (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="text-xs font-medium">{t(`settings.${providerName}StoredLabel` as never) as string}</p>
            <p className="text-muted-foreground font-mono text-sm">{stored.apiKeyMasked}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            {t('common.remove')}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`account-${providerName}-apikey`}>
          {stored?.source === 'account'
            ? (t(`settings.${providerName}ReplaceApiKey` as never) as string)
            : (t(`settings.${providerName}ApiKey` as never) as string)}
        </Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id={`account-${providerName}-apikey`}
              type={showApiKey ? 'text' : 'password'}
              placeholder={apiKeyConfig.placeholder}
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
          <Button
            type="button"
            variant="secondary"
            disabled={!canTest}
            onClick={handleTest}
            data-testid={`provider-card-${providerName}-test`}
          >
            {testing
              ? (t(`settings.${providerName}Testing` as never) as string)
              : testCooldownSeconds > 0
                ? `Aguarde ${testCooldownSeconds}s`
                : (t(`settings.${providerName}Test` as never) as string)}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{apiKeyConfig.helperText}</p>
      </div>

      {footerSlot != null && (
        <div className="mt-4 border-t pt-4" data-testid={`provider-card-${providerName}-footer`}>
          {footerSlot}
        </div>
      )}

      <Button type="submit" disabled={busy || !isApiKeyValid(apiKey)}>
        {saving ? t('common.loading') : (t(`settings.${providerName}Save` as never) as string)}
      </Button>
    </form>
  );
}
