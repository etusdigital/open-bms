import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';
import { ImportStatusView } from '@/features/super-admin/accounts/import-status-view';

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

// UI-only wizard step (igual ao GeoIP). Aceita "Pular" (registra
// enterprise_import_done={imported:false}) ou form (inicia job e mostra
// progresso simplificado; o usuário pode "Continuar mesmo assim" pra liberar
// próximos steps — o import segue rodando em background no worker).
export function Step2EnterpriseImport({ onComplete, onBack }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  // Sempre começar do 0: ao (re)abrir o step, para a fila e apaga a pegada do
  // import anterior ANTES de liberar o form (senão um novo import seria
  // criado e logo apagado). Idempotente; falha é não-fatal.
  const [resetting, setResetting] = useState(true);
  const didReset = useRef(false);

  useEffect(() => {
    if (didReset.current) return; // guarda contra double-mount (StrictMode)
    didReset.current = true;
    (async () => {
      try {
        await setupGateway.resetEnterpriseImport();
      } catch {
        // não-fatal: feature off (404) / setup concluído / erro — o submit
        // reaplica os mesmos gates no backend.
      } finally {
        setResetting(false);
      }
    })();
  }, []);

  async function handleSkip() {
    setSubmitting(true);
    setError(null);
    try {
      await setupGateway.importEnterprise({ skip: true });
      onComplete();
    } catch (err) {
      setError(extractError(err, 'Erro ao pular etapa.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (baseUrl.trim().length < 8 || !/^https?:\/\//.test(baseUrl.trim())) {
      setError('Informe a URL base do msgops-api Enterprise (https://...).');
      return;
    }
    if (apiKey.trim().length < 8) {
      setError('Informe a API key (mínimo 8 caracteres).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await setupGateway.importEnterprise({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        accountName: accountName.trim() || undefined,
      });
      if (res.jobId) setJobId(res.jobId);
    } catch (err) {
      setError(extractError(err, 'Erro ao iniciar import.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (resetting) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">Preparando o ambiente de import (sempre começa do zero)…</p>
      </div>
    );
  }

  if (jobId) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          O import está rodando em background. Você pode acompanhar aqui ou continuar para os próximos passos — o worker segue importando.
        </p>
        <ImportStatusView jobId={jobId} hideResume />
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            Voltar
          </Button>
          <Button onClick={onComplete}>Continuar mesmo assim</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Cria uma conta neste OSS e importa os dados da sua conta do BMS Enterprise (contatos, campanhas, automações, mensagens e estatísticas) via API key. Roda em
        background. Caso contrário, pule esta etapa. (Migração da instância inteira é um procedimento separado — consulte a documentação de operações.)
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-import-accountName">Nome da conta no OSS</Label>
        <Input
          id="setup-import-accountName"
          autoComplete="off"
          placeholder="Ex.: Minha Empresa (importada do Enterprise)"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-import-baseUrl">URL do msgops-api Enterprise</Label>
        <Input
          id="setup-import-baseUrl"
          autoComplete="off"
          placeholder="https://api.enterprise.exemplo.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-import-apiKey">API key Enterprise</Label>
        <Input
          id="setup-import-apiKey"
          type="password"
          autoComplete="off"
          placeholder="(secreto)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-2 flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={handleSkip} disabled={submitting}>
            Pular esta etapa
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Iniciando…' : 'Importar do Enterprise'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) return String(err.response.data.message);
  return fallback;
}
