import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { setupGateway } from '@/features/setup/setup-gateway';
import { s3Gateway } from '@/features/super-admin/integrations/s3-gateway';

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

export function Step5S3({ onComplete, onBack }: Props) {
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [useObjectAcls, setUseObjectAcls] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isValid = !!bucket && !!accessKeyId && !!secretAccessKey;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setSaving(true);
    try {
      await setupGateway.submitS3({
        endpoint: endpoint || undefined,
        region: region || undefined,
        bucket,
        accessKeyId,
        secretAccessKey,
        useObjectAcls,
      });
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao salvar configuração S3.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    setTesting(true);
    try {
      const result = await s3Gateway.testConnection({
        endpoint: endpoint || undefined,
        region: region || undefined,
        bucket: bucket || undefined,
        accessKeyId: accessKeyId || undefined,
        secretAccessKey: secretAccessKey || undefined,
      });
      setTestResult({ ok: result.ok, message: result.ok ? 'Conexão bem-sucedida.' : (result.errorMessage ?? 'Falha na conexão.') });
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao testar conexão.';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-muted-foreground text-xs">
        O S3 é necessário para salvar mensagens de email. Configure um bucket compatível com a API
        S3 (AWS, Cloudflare R2, etc.). Pode ser alterado depois em Super Admin → Integrações → S3.
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setup-s3-endpoint">Endpoint (opcional)</Label>
          <Input
            id="setup-s3-endpoint"
            placeholder="https://s3.amazonaws.com"
            value={endpoint}
            onChange={(e) => { setEndpoint(e.target.value); setTestResult(null); }}
            disabled={saving}
          />
          <p className="text-muted-foreground text-xs">Deixe vazio para AWS S3 padrão.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setup-s3-region">Region</Label>
          <Input
            id="setup-s3-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setup-s3-bucket">Bucket</Label>
          <Input
            id="setup-s3-bucket"
            value={bucket}
            onChange={(e) => { setBucket(e.target.value); setTestResult(null); }}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setup-s3-akid">Access Key ID</Label>
          <Input
            id="setup-s3-akid"
            autoComplete="off"
            value={accessKeyId}
            onChange={(e) => { setAccessKeyId(e.target.value); setTestResult(null); }}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setup-s3-secret">Secret Access Key</Label>
          <div className="relative">
            <Input
              id="setup-s3-secret"
              type={showSecret ? 'text' : 'password'}
              autoComplete="new-password"
              value={secretAccessKey}
              onChange={(e) => { setSecretAccessKey(e.target.value); setTestResult(null); }}
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
            id="setup-s3-acls"
            type="checkbox"
            checked={useObjectAcls}
            onChange={(e) => setUseObjectAcls(e.target.checked)}
            disabled={saving}
          />
          <Label htmlFor="setup-s3-acls" className="cursor-pointer text-sm">
            Usar ACLs de objeto
          </Label>
        </div>
        <p className="text-muted-foreground -mt-2 text-xs">
          Desmarque em buckets AWS pós-2023 (BucketOwnerEnforced).
        </p>
      </div>

      {testResult && (
        <Alert variant={testResult.ok ? 'success' : 'destructive'}>
          <AlertDescription>{testResult.message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" disabled={saving} onClick={onBack}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving || testing || !isValid}
            onClick={handleTest}
          >
            {testing ? 'Testando...' : 'Testar conexão'}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" disabled={saving} onClick={onComplete}>
                Pular
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Mensagens de email não poderão ser salvas sem S3 configurado.
            </TooltipContent>
          </Tooltip>
          <Button type="submit" disabled={saving || !isValid}>
            {saving ? 'Salvando...' : 'Salvar e continuar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
