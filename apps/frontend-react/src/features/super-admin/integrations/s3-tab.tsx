import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { s3Gateway, type S3AdminSettings } from './s3-gateway';

export function S3Tab() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<S3AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [useObjectAcls, setUseObjectAcls] = useState(true);
  const [assetsUrl, setAssetsUrl] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    let cancelled = false;
    s3Gateway
      .get()
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSettings(data);
          setEndpoint(data.endpoint ?? '');
          setRegion(data.region ?? 'us-east-1');
          setBucket(data.bucket ?? '');
          setAccessKeyId(data.accessKeyId ?? '');
          setUseObjectAcls(data.useObjectAcls !== false);
          setAssetsUrl(data.assetsUrl ?? '');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : t('integrations.s3.loadError');
        toast.error(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const hasExistingSecret = !!settings?.secretAccessKeyMasked;
  const endpointChanged = !!settings && (settings.endpoint ?? '') !== endpoint;
  const secretRequired = !hasExistingSecret || endpointChanged;
  const isValid = !!bucket && !!accessKeyId && (!!secretAccessKey || !secretRequired);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        endpoint: endpoint || undefined,
        region: region || undefined,
        bucket,
        accessKeyId,
        ...(secretAccessKey ? { secretAccessKey } : {}),
        useObjectAcls,
        assetsUrl: assetsUrl || undefined,
      };
      const updated = await s3Gateway.save(payload);
      setSettings(updated);
      setSecretAccessKey('');
      setAssetsUrl(updated.assetsUrl ?? '');
      toast.success(t('integrations.s3.saveOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.s3.saveError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await s3Gateway.testConnection({
        endpoint: endpoint || undefined,
        region: region || undefined,
        bucket: bucket || undefined,
        accessKeyId: accessKeyId || undefined,
        ...(secretAccessKey ? { secretAccessKey } : {}),
      });
      if (result.ok) toast.success(t('integrations.s3.testOk'));
      else toast.error(result.errorMessage ?? t('integrations.s3.testError'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? String(err.response.data.message)
        : t('integrations.s3.testError');
      toast.error(msg);
    } finally {
      setTesting(false);
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
      <div className="space-y-2">
        <Label htmlFor="s3-endpoint">{t('integrations.s3.endpoint')}</Label>
        <Input
          id="s3-endpoint"
          placeholder="https://s3.amazonaws.com"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.s3.endpointHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="s3-region">{t('integrations.s3.region')}</Label>
        <Input id="s3-region" value={region} onChange={(e) => setRegion(e.target.value)} disabled={saving} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="s3-bucket">{t('integrations.s3.bucket')}</Label>
        <Input id="s3-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} disabled={saving} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="s3-akid">{t('integrations.s3.accessKeyId')}</Label>
        <Input id="s3-akid" autoComplete="off" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} disabled={saving} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="s3-secret">{t('integrations.s3.secretAccessKey')}</Label>
        {hasExistingSecret && (
          <div className="bg-muted rounded-md px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t('integrations.s3.secretStored')}: </span>
            <span className="font-mono">{settings?.secretAccessKeyMasked}</span>
          </div>
        )}
        {endpointChanged && !secretAccessKey && (
          <p className="text-destructive text-xs">{t('integrations.s3.secretRequiredOnEndpointChange')}</p>
        )}
        <div className="relative">
          <Input
            id="s3-secret"
            type={showSecret ? 'text' : 'password'}
            placeholder={hasExistingSecret ? t('integrations.s3.secretReplace') : ''}
            autoComplete="new-password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
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
      </div>

      <div className="flex items-center gap-2">
        <input
          id="s3-acls"
          type="checkbox"
          checked={useObjectAcls}
          onChange={(e) => setUseObjectAcls(e.target.checked)}
          disabled={saving}
        />
        <Label htmlFor="s3-acls" className="cursor-pointer">{t('integrations.s3.useObjectAcls')}</Label>
      </div>
      <p className="text-muted-foreground -mt-3 text-xs">{t('integrations.s3.useObjectAclsHelp')}</p>

      <div className="space-y-2">
        <Label htmlFor="s3-assets">{t('integrations.s3.assetsUrl')}</Label>
        <Input
          id="s3-assets"
          placeholder="cdn.example.com"
          value={assetsUrl}
          onChange={(e) => setAssetsUrl(e.target.value)}
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">{t('integrations.s3.assetsUrlHelp')}</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !isValid}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
        <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? t('common.loading') : t('integrations.testConnection')}
        </Button>
      </div>
    </form>
  );
}
