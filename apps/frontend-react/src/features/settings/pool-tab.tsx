import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app-store';
import { poolGateway, type Pool } from './pool-gateway';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function normalizeIps(raw: Pool['ip']): string[] {
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
  const accountId = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account.id : 0));

  const [pool, setPool] = useState<Pool | null>(null);
  const [name, setName] = useState('');
  const [poolName, setPoolName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderReplyTo, setSenderReplyTo] = useState('');
  const [sendingLimit, setSendingLimit] = useState('1000');
  const [ips, setIps] = useState<string[]>([]);
  const [ipInput, setIpInput] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    poolGateway
      .list()
      .then((pools) => {
        if (cancelled) return;
        const myPools = pools.filter((p) => p.accountId === accountId);
        const target = myPools.find((p) => p.isDefault) ?? myPools[0] ?? null;
        if (target) {
          setPool(target);
          setName(target.name ?? '');
          setPoolName(target.poolName ?? '');
          setSenderEmail(target.senderEmail ?? '');
          setSenderName(target.senderName ?? '');
          setSenderReplyTo(target.senderReplyTo ?? '');
          setSendingLimit(String(target.sendingLimit ?? 1000));
          setIps(normalizeIps(target.ip));
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('settings.poolLoadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, t]);

  function addIp() {
    const v = ipInput.trim();
    if (!v) return;
    if (!IPV4_RE.test(v) && !IPV6_RE.test(v)) {
      toast.error(t('settings.poolIpInvalid'));
      return;
    }
    if (ips.includes(v)) {
      setIpInput('');
      return;
    }
    setIps((prev) => [...prev, v]);
    setIpInput('');
  }

  function removeIp(ip: string) {
    setIps((prev) => prev.filter((x) => x !== ip));
  }

  function onIpKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addIp();
    }
  }

  function validate(): string | null {
    if (!name.trim()) return t('settings.poolNameRequired');
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
      poolName: poolName.trim() || name.trim(),
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
          <Label htmlFor="settings-pool-pool-name">{t('settings.poolInternalName')}</Label>
          <Input
            id="settings-pool-pool-name"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            disabled={saving}
            placeholder="bms-pool-01"
          />
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
        <Label htmlFor="settings-pool-ips">{t('settings.poolIps')}</Label>
        <div className="border-border rounded-md border px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {ips.map((ip) => (
              <span
                key={ip}
                className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
              >
                {ip}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() => removeIp(ip)}
                  aria-label={`Remover ${ip}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Input
              id="settings-pool-ips"
              placeholder={t('settings.poolIpsPlaceholder')}
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={onIpKeyDown}
              onBlur={addIp}
              disabled={saving}
              className="h-7 flex-1 min-w-[160px] border-0 px-1 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? t('common.loading') : t('common.save')}
      </Button>
    </form>
  );
}
