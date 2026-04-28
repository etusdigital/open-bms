import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  onComplete: () => void;
}

export function Step2Smtp({ onComplete }: Props) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      host: host.trim(),
      port: Number(port),
      user: user.trim(),
      pass,
      from: from.trim(),
    };
  }

  function validate(): string | null {
    const p = payload();
    if (!p.host) return 'Host SMTP obrigatório.';
    if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535) return 'Porta inválida.';
    if (!p.user) return 'Usuário obrigatório.';
    if (!p.pass) return 'Senha obrigatória.';
    if (!EMAIL_RE.test(p.from)) return 'E-mail remetente inválido.';
    return null;
  }

  async function handleTest() {
    setError(null);
    const localErr = validate();
    if (localErr) {
      setError(localErr);
      return;
    }
    setTesting(true);
    try {
      await setupGateway.testSmtp(payload());
      toast.success('E-mail de teste enviado para o administrador cadastrado no passo 1.');
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Falha ao enviar e-mail de teste.';
      toast.error(msg);
    } finally {
      setTesting(false);
    }
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
      await setupGateway.advanceStep({ step: 2, data: payload() });
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao salvar configuração SMTP.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || testing;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtp-host">Host SMTP</Label>
          <Input
            id="smtp-host"
            placeholder="smtp.sendgrid.net"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="smtp-port">Porta</Label>
          <Input
            id="smtp-port"
            type="number"
            placeholder="587"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="smtp-user">Usuário</Label>
        <Input
          id="smtp-user"
          placeholder="apikey"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="smtp-pass">Senha</Label>
        <Input
          id="smtp-pass"
          type="password"
          placeholder="SG.xxxxx"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="smtp-from">E-mail remetente (from)</Label>
        <Input
          id="smtp-from"
          type="email"
          placeholder="noreply@empresa.com"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="bg-card border-border rounded-2xl border px-5 py-4 shadow-sm">
        <p className="text-foreground mb-1 text-xs font-bold">Teste de envio</p>
        <p className="text-muted-foreground mb-3 text-xs">
          O teste envia um e-mail para o endereço do administrador criado no passo 1.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" disabled={busy} onClick={handleTest}>
            {testing ? 'Enviando...' : 'Enviar teste'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {submitting ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
    </form>
  );
}
