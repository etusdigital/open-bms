import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/stores/app-store';
import { poolGateway, type Pool } from './pool-gateway';
import { poolSendgridGateway, type SendgridPoolOption } from './pool-sendgrid-gateway';
import { accountSendgridGateway, type SendgridKeySource } from './sendgrid-account-gateway';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeStoredIps(raw: Pool['ip']): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return raw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function PoolTab() {
  const { t } = useTranslation();
  const accountId = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account.id.toString() : '0'));

  const [pool, setPool] = useState<Pool | null>(null);
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderReplyTo, setSenderReplyTo] = useState('');
  const [sendingLimit, setSendingLimit] = useState('1000');

  // SendGrid-backed selection: the user can no longer type a free-form pool
  // name or arbitrary IPs — both come from the SendGrid account configured
  // for this BMS account. `selectedPool` is the SendGrid pool name; `ips`
  // is the read-only set of IPs that pool advertises on SendGrid.
  const [sendgridPools, setSendgridPools] = useState<SendgridPoolOption[]>([]);
  const [sendgridKeySource, setSendgridKeySource] = useState<SendgridKeySource>('none');
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [ips, setIps] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingIps, setLoadingIps] = useState(false);
  const [saving, setSaving] = useState(false);

  // Loads (a) the existing local pool row, (b) the list of SendGrid pools
  // and (c) the SendGrid key status for this account. We need (c) to
  // distinguish two "empty pools" cases: no key configured at all (then
  // tell the user to configure SendGrid) vs key configured on a Free/
  // Essentials plan that just has no dedicated IP pools (then let the
  // user save a pool without selecting one — sends use SendGrid shared
  // IPs by default).
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    Promise.all([
      poolGateway.list().catch((err) => {
        if (!axios.isAxiosError(err) || err.response?.status !== 404) {
          const msg = axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : t('settings.poolLoadError');
          toast.error(msg);
        }
        return [] as Pool[];
      }),
      poolSendgridGateway.listPools().catch(() => {
        // Empty array → form treats it the same as "Free plan with no
        // dedicated pools": user can still save a sender pool, sends
        // fall back to SendGrid shared IPs.
        return [] as SendgridPoolOption[];
      }),
      accountSendgridGateway.get(accountId).catch(() => ({ source: 'none' as SendgridKeySource, apiKeyMasked: null, webhookUrl: null })),
    ]).then(([pools, sgPools, sgStatus]) => {
      if (cancelled) return;
      setSendgridPools(sgPools);
      setSendgridKeySource(sgStatus.source);

      const myPools = pools.filter((p) => p.accountId === accountId);
      const target = myPools.find((p) => p.isDefault) ?? myPools[0] ?? null;
      if (target) {
        setPool(target);
        setName(target.name ?? '');
        setSenderEmail(target.senderEmail ?? '');
        setSenderName(target.senderName ?? '');
        setSenderReplyTo(target.senderReplyTo ?? '');
        setSendingLimit(String(target.sendingLimit ?? 1000));
        const storedPoolName = target.poolName ?? '';
        setSelectedPool(storedPoolName);
        setIps(normalizeStoredIps(target.ip));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, t]);

  // Whenever the user picks a different SendGrid pool, refresh the IP list
  // from the SendGrid API so the saved row reflects what's actually
  // assigned right now (IPs in pools change on the SendGrid side over
  // time). The `read-only` semantics matter: if SendGrid says the pool has
  // 3 IPs, we save those 3 — not whatever a stale form had.
  useEffect(() => {
    if (!selectedPool) {
      setIps([]);
      return;
    }
    let cancelled = false;
    setLoadingIps(true);
    poolSendgridGateway
      .listIpsForPool(selectedPool)
      .then((rows) => {
        if (cancelled) return;
        setIps(rows.map((r) => r.ip).filter(Boolean));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('settings.poolIpsLoadError');
        toast.error(msg);
        setIps([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingIps(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPool, t]);

  function validate(): string | null {
    if (!name.trim()) return t('settings.poolNameRequired');
    // SendGrid pool selection is required only when the account actually
    // has SendGrid pools to choose from. Free/Essentials plans have none
    // and the form lets users save without one — the worker omits
    // ip_pool_name from the SendGrid payload and falls back to shared IPs.
    if (sendgridPools.length > 0 && !selectedPool) return t('settings.poolSendgridPoolRequired');
    if (senderEmail && !EMAIL_RE.test(senderEmail)) return t('settings.poolSenderEmailInvalid');
    if (senderReplyTo && !EMAIL_RE.test(senderReplyTo)) return t('settings.poolReplyToInvalid');
    if (sendingLimit) {
      const limit = Number(sendingLimit);
      if (!Number.isInteger(limit) || limit < 1) return t('settings.poolSendingLimitInvalid');
    }
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      poolName: selectedPool,
      ...(senderEmail.trim() && { senderEmail: senderEmail.trim().toLowerCase() }),
      ...(senderName.trim() && { senderName: senderName.trim() }),
      ...(senderReplyTo.trim() && { senderReplyTo: senderReplyTo.trim().toLowerCase() }),
      ...(sendingLimit && { sendingLimit: Number(sendingLimit) }),
      ip: JSON.stringify(ips),
      ...(pool ? {} : { accountId, isDefault: true }),
    };

    try {
      if (pool) {
        const updated = await poolGateway.update(pool.id, payload);
        setPool(updated);
      } else {
        const created = await poolGateway.create(payload);
        setPool(created);
      }
      toast.success(t('settings.poolSaveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('settings.poolSaveError');
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
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  // Hard block when the account has no SendGrid key configured at all
  // (own key absent and no global fallback set): there's no point letting
  // them save anything because emails wouldn't go out. Point them at the
  // SendGrid tab to fix the prerequisite. We do NOT block when the key
  // exists but the SendGrid plan has no IP pools — that's the Free tier
  // case handled below in the form.
  if (sendgridKeySource === 'none') {
    return (
      <div className="max-w-2xl rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('settings.poolNeedsSendgridTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('settings.poolNeedsSendgridDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasSendgridPools = sendgridPools.length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-4">
      <p className="text-muted-foreground text-xs">{t('settings.poolHelp')}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-pool-name">{t('settings.poolName')}</Label>
          <Input
            id="settings-pool-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder="Pool Principal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-pool-sendgrid">{t('settings.poolSendgridPool')}</Label>
          {hasSendgridPools ? (
            <Select value={selectedPool} onValueChange={setSelectedPool} disabled={saving}>
              <SelectTrigger id="settings-pool-sendgrid">
                <SelectValue placeholder={t('settings.poolSendgridPoolPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {sendgridPools.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="bg-muted/30 rounded-md border px-3 py-2 text-xs">
              <p className="text-muted-foreground">{t('settings.poolNoSendgridPoolsHelp')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-pool-sender-email">{t('settings.poolSenderEmail')}</Label>
          <Input
            id="settings-pool-sender-email"
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            disabled={saving}
            placeholder="noreply@empresa.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-pool-sender-name">{t('settings.poolSenderName')}</Label>
          <Input
            id="settings-pool-sender-name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            disabled={saving}
            placeholder="Empresa"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-pool-replyto">{t('settings.poolReplyTo')}</Label>
          <Input
            id="settings-pool-replyto"
            type="email"
            value={senderReplyTo}
            onChange={(e) => setSenderReplyTo(e.target.value)}
            disabled={saving}
            placeholder="contato@empresa.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-pool-limit">{t('settings.poolSendingLimit')}</Label>
          <Input
            id="settings-pool-limit"
            type="number"
            min={1}
            value={sendingLimit}
            onChange={(e) => setSendingLimit(e.target.value)}
            disabled={saving}
            placeholder="1000"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('settings.poolIps')}</Label>
        <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
          {!hasSendgridPools ? (
            <p className="text-muted-foreground text-xs">{t('settings.poolIpsSharedSendgrid')}</p>
          ) : loadingIps ? (
            <p className="text-muted-foreground text-xs">{t('settings.poolIpsLoading')}</p>
          ) : !selectedPool ? (
            <p className="text-muted-foreground text-xs">{t('settings.poolIpsSelectPoolFirst')}</p>
          ) : ips.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('settings.poolIpsEmpty')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {ips.map((ip) => (
                <span
                  key={ip}
                  className="bg-secondary text-secondary-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs"
                >
                  {ip}
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{t('settings.poolIpsReadonlyHelp')}</p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? t('common.loading') : t('common.save')}
      </Button>
    </form>
  );
}
