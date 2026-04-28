import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBUSER_PREFIX_RE = /^[a-z0-9-]+$/;

interface Props {
  onComplete: () => void;
  baseUrl?: string;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function Step4Sendgrid({ onComplete, baseUrl }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [subuserEmail, setSubuserEmail] = useState('');
  const [subuserPrefix, setSubuserPrefix] = useState('bms');
  const [defaultIpPool, setDefaultIpPool] = useState('');
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('');
  const [testResult, setTestResult] = useState<{ accountName: string | null } | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTestedKey = useRef<string>('');
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (prefilledRef.current) return;
    if (baseUrl && !webhookBaseUrl) {
      setWebhookBaseUrl(`${baseUrl.replace(/\/$/, '')}/bms/events`);
      prefilledRef.current = true;
    }
  }, [baseUrl, webhookBaseUrl]);

  function onApiKeyChange(value: string) {
    setApiKey(value);
    if (value !== lastTestedKey.current) setTestResult(null);
  }

  async function handleTest() {
    setError(null);
    if (!apiKey.startsWith('SG.') || apiKey.length < 10) {
      setError('Informe uma API Key válida começando com "SG.".');
      return;
    }
    setTesting(true);
    try {
      const res = await setupGateway.testSendgrid(apiKey);
      setTestResult(res);
      lastTestedKey.current = apiKey;
      toast.success(`Credenciais válidas${res.accountName ? ` (conta: ${res.accountName})` : ''}.`);
    } catch (err) {
      setTestResult(null);
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Falha ao validar credenciais SendGrid.';
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    setError(null);
    try {
      await setupGateway.advanceStep({ step: 4, data: { skip: true } });
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao pular SendGrid.';
      setError(msg);
      setSkipping(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!testResult) {
      setError('Teste as credenciais antes de continuar.');
      return;
    }
    if (apiKey !== lastTestedKey.current) {
      setError('A API Key foi alterada após o teste. Teste novamente.');
      return;
    }
    if (!EMAIL_RE.test(subuserEmail)) {
      setError('E-mail do billing inválido.');
      return;
    }
    if (subuserPrefix && !SUBUSER_PREFIX_RE.test(subuserPrefix)) {
      setError('Prefixo de subusuários: use apenas letras minúsculas, números e hífen.');
      return;
    }
    if (webhookBaseUrl && !isValidUrl(webhookBaseUrl)) {
      setError('URL do webhook inválida.');
      return;
    }
    setSubmitting(true);
    try {
      await setupGateway.advanceStep({
        step: 4,
        data: {
          apiKey,
          subuserEmail: subuserEmail.trim().toLowerCase(),
          ...(subuserPrefix && { subuserPrefix }),
          ...(defaultIpPool && { defaultIpPool: defaultIpPool.trim() }),
          ...(webhookBaseUrl && { webhookBaseUrl: webhookBaseUrl.trim() }),
        },
      });
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao salvar configuração SendGrid.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || testing || skipping;
  const canTest = apiKey.startsWith('SG.') && apiKey.length >= 10 && !testing;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <details className="text-muted-foreground text-xs">
        <summary className="text-primary cursor-pointer font-medium">O que é isso e quando pular?</summary>
        <p className="mt-2 leading-relaxed">
          SendGrid é o motor de disparo em massa do BMS — campanhas, automações e transacionais de marketing. O SMTP do passo 2 é usado só
          pra e-mail operacional interno (reset de senha, alertas). Se sua instância não vai disparar campanhas agora, pule esta etapa — dá
          pra configurar depois em Super Admin.
        </p>
      </details>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sg-apikey">API Key SendGrid</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id="sg-apikey"
              type={showApiKey ? 'text' : 'password'}
              placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
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
          <Button type="button" variant="secondary" disabled={!canTest || busy} onClick={handleTest}>
            {testing ? 'Testando...' : 'Testar credenciais'}
          </Button>
        </div>
        {testResult && (
          <div className="text-xs flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Conectado{testResult.accountName ? ` — ${testResult.accountName}` : ''}
            </span>
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          Encontre em app.sendgrid.com → Settings → API Keys. Precisa ter permissão Full Access.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sg-subuser-email">E-mail do billing da conta SendGrid</Label>
        <Input
          id="sg-subuser-email"
          type="email"
          placeholder="billing@empresa.com"
          value={subuserEmail}
          onChange={(e) => setSubuserEmail(e.target.value)}
          disabled={busy}
        />
        <p className="text-muted-foreground text-xs">Usado como contato do owner ao provisionar sub-accounts.</p>
      </div>

      <div className="bg-card border-border rounded-2xl border px-5 py-4 shadow-sm">
        <p className="text-foreground mb-3 text-xs font-bold">Configurações avançadas (opcional)</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-prefix">Prefixo de subusuários</Label>
            <Input
              id="sg-prefix"
              placeholder="bms"
              value={subuserPrefix}
              onChange={(e) => setSubuserPrefix(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-pool">IP Pool padrão</Label>
            <Input
              id="sg-pool"
              placeholder="bms-ip-pool-01"
              value={defaultIpPool}
              onChange={(e) => setDefaultIpPool(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="sg-webhook">URL do webhook</Label>
          <Input
            id="sg-webhook"
            placeholder="https://app.empresa.com/bms/events"
            value={webhookBaseUrl}
            onChange={(e) => setWebhookBaseUrl(e.target.value)}
            disabled={busy}
          />
          <p className="text-muted-foreground text-xs">
            Pré-preenchida com a URL base (passo 3) + /bms/events. Edite só se o BMS estiver atrás de um prefixo diferente.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="secondary" disabled={busy} onClick={handleSkip}>
          {skipping ? 'Pulando...' : 'Pular esta etapa'}
        </Button>
        <Button type="submit" disabled={busy || !testResult}>
          {submitting ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
    </form>
  );
}
