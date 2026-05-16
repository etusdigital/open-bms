import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { setupGateway } from '@/features/setup/setup-gateway';
import { ImportStatusView } from '@/features/super-admin/accounts/import-status-view';
import { useImportStatus } from '@/features/super-admin/accounts/use-import-status';

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

type SubmitPayload = { baseUrl: string; apiKey: string; accountName?: string; useStep1Account?: boolean };

// UI-only wizard step. Aceita "Pular" (registra enterprise_import_done) ou
// form (inicia job e mostra progresso). Três ações pedidas:
//  1. Checkbox "usar a conta do passo 1" — importa na conta já criada no passo
//     1 em vez de criar uma conta nova/descartável.
//  2. "Tentar novamente" quando o job falha — reusa o reset existente (cancela
//     o job + limpa) e reinicia o import com os mesmos dados (job novo).
//  3. "Recomeçar do zero" sempre visível — mesmo reset e volta ao formulário.
export function Step2EnterpriseImport({ onComplete, onBack }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [step1Account, setStep1Account] = useState<{ id: number; name: string } | null>(null);
  const [useStep1Account, setUseStep1Account] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  // Sempre começar do 0: ao (re)abrir o step, para a fila e apaga a pegada do
  // import anterior ANTES de liberar o form (senão um novo import seria
  // criado e logo apagado). Idempotente; falha é não-fatal.
  const [resetting, setResetting] = useState(true);
  const didReset = useRef(false);
  // Guarda o último payload enviado pra o "Tentar novamente" reenviar igual.
  const lastSubmitRef = useRef<SubmitPayload | null>(null);

  // Status do job (mesma query/poll do ImportStatusView — react-query dedupe
  // pela queryKey, então não duplica polling). Usado só pra saber se falhou.
  const { data: jobStatus } = useImportStatus(jobId ?? undefined);
  const failed = jobStatus?.status === 'failed';

  // Reset-on-open + carrega a conta do passo 1 (pro checkbox). O getStatus vem
  // DEPOIS do reset porque o reset recria a conta do passo 1 server-side.
  async function prepareEnvironment() {
    try {
      await setupGateway.resetEnterpriseImport();
    } catch {
      // não-fatal: feature off (404) / setup concluído / erro — o submit
      // reaplica os mesmos gates no backend.
    }
    try {
      const status = await setupGateway.getStatus();
      setStep1Account(status.step1Account ?? null);
      // Reusar a conta do passo 1 é o caminho recomendado (não prolifera
      // contas) — vem marcado quando existe; o usuário pode desmarcar.
      setUseStep1Account(!!status.step1Account);
    } catch {
      setStep1Account(null);
    }
  }

  useEffect(() => {
    if (didReset.current) return; // guarda contra double-mount (StrictMode)
    didReset.current = true;
    (async () => {
      await prepareEnvironment();
      setResetting(false);
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

  function validate(): string | null {
    if (baseUrl.trim().length < 8 || !/^https?:\/\//.test(baseUrl.trim())) {
      return 'Informe a URL base do msgops-api Enterprise (https://...).';
    }
    if (apiKey.trim().length < 8) {
      return 'Informe a API key (mínimo 8 caracteres).';
    }
    return null;
  }

  function buildPayload(): SubmitPayload {
    return useStep1Account
      ? { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), useStep1Account: true }
      : { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), accountName: accountName.trim() || undefined };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const localErr = validate();
    if (localErr) {
      setError(localErr);
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      lastSubmitRef.current = payload;
      const res = await setupGateway.importEnterprise(payload);
      if (res.jobId) setJobId(res.jobId);
    } catch (err) {
      setError(extractError(err, 'Erro ao iniciar import.'));
    } finally {
      setSubmitting(false);
    }
  }

  // Ação 2: reusa o reset existente (cancela o job atual + limpa) e reinicia
  // o import com os MESMOS dados — job novo, do zero.
  async function handleRetry() {
    if (!lastSubmitRef.current) return;
    setSubmitting(true);
    setError(null);
    try {
      await setupGateway.resetEnterpriseImport();
      const res = await setupGateway.importEnterprise(lastSubmitRef.current);
      setJobId(res.jobId ?? null);
    } catch (err) {
      setError(extractError(err, 'Erro ao reiniciar o import.'));
    } finally {
      setSubmitting(false);
    }
  }

  // Ação 3: reset manual — limpa tudo e volta ao formulário.
  async function handleManualReset() {
    setConfirmResetOpen(false);
    setSubmitting(true);
    setError(null);
    setJobId(null);
    lastSubmitRef.current = null;
    try {
      await prepareEnvironment();
    } catch (err) {
      setError(extractError(err, 'Erro ao recomeçar.'));
    } finally {
      setSubmitting(false);
    }
  }

  const resetButton = (
    <Button type="button" variant="ghost" onClick={() => setConfirmResetOpen(true)} disabled={submitting || resetting}>
      Reiniciar
    </Button>
  );

  const resetConfirmDialog = (
    <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recomeçar o import do zero?</AlertDialogTitle>
          <AlertDialogDescription>
            Isto cancela o job atual e apaga os dados já importados. A conta criada no passo 1 é preservada (o vínculo do
            admin não é perdido). Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleManualReset}>Recomeçar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

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
          O import está rodando em background. Você pode acompanhar aqui ou continuar para os próximos passos — o worker
          segue importando.
        </p>
        <ImportStatusView jobId={jobId} hideResume />
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>
              O import falhou. "Tentar novamente" cancela este job, limpa o que foi importado e reinicia do zero com os
              mesmos dados.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            Voltar
          </Button>
          <div className="flex gap-2">
            {resetButton}
            {failed && (
              <Button type="button" variant="secondary" onClick={handleRetry} disabled={submitting}>
                {submitting ? 'Reiniciando…' : 'Tentar novamente'}
              </Button>
            )}
            <Button onClick={onComplete} disabled={submitting}>
              Continuar mesmo assim
            </Button>
          </div>
        </div>
        {resetConfirmDialog}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Cria uma conta neste OSS e importa os dados da sua conta do BMS Enterprise (contatos, campanhas, automações,
        mensagens e estatísticas) via API key. Roda em background. Caso contrário, pule esta etapa. (Migração da
        instância inteira é um procedimento separado — consulte a documentação de operações.)
      </p>

      {step1Account && (
        <div className="flex items-start gap-2 rounded-md border p-3">
          <Checkbox
            id="setup-import-useStep1"
            checked={useStep1Account}
            onCheckedChange={(v) => setUseStep1Account(v === true)}
            disabled={submitting}
          />
          <div className="grid gap-1">
            <Label htmlFor="setup-import-useStep1" className="cursor-pointer">
              Importar para a conta criada no passo 1 (“{step1Account.name}”)
            </Label>
            <p className="text-muted-foreground text-xs">
              Recomendado — não cria uma conta extra. Desmarque para criar uma conta nova só para o import.
            </p>
          </div>
        </div>
      )}

      {!useStep1Account && (
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
      )}
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
      {resetConfirmDialog}
    </form>
  );
}

function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) return String(err.response.data.message);
  return fallback;
}
