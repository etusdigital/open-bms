import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';
import { login } from '@/features/auth/use-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  onComplete: () => void;
}

export function Step1Admin({ onComplete }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (name.trim().length < 2) return 'Informe seu nome completo.';
    if (!EMAIL_RE.test(email)) return 'E-mail inválido.';
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (password !== confirmPassword) return 'As senhas não conferem.';
    if (accountName.trim().length < 1) return 'Informe o nome da conta.';
    return null;
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
      await setupGateway.advanceStep({
        step: 1,
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          accountName: accountName.trim(),
        },
      });
      // Auto-login: subsequent steps may need an authenticated session and the
      // operator just typed valid credentials. Mirrors Vue 3 wizard behavior.
      try {
        await login(email.trim().toLowerCase(), password);
      } catch {
        // Auto-login is best-effort. Steps 2-6 are public on the backend, so
        // a failure here doesn't block the wizard.
      }
      // SMTP step is hidden in this UI — auto-skip it on the backend so the
      // wizard's currentStep advances past 2 before the user lands on Domínio.
      try {
        await setupGateway.advanceStep({ step: 2, data: { skip: true } });
      } catch {
        // Idempotent on the backend; if it has already been skipped (e.g. user
        // refreshed mid-flow), the next advance call will succeed anyway.
      }
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao criar administrador.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-admin-name">Nome completo</Label>
        <Input
          id="setup-admin-name"
          autoFocus
          autoComplete="name"
          placeholder="João Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-admin-email">E-mail</Label>
        <Input
          id="setup-admin-email"
          type="email"
          autoComplete="email"
          placeholder="admin@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-admin-password">Senha</Label>
        <Input
          id="setup-admin-password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-admin-confirm">Confirmar senha</Label>
        <Input
          id="setup-admin-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-admin-account-name">Nome da conta</Label>
        <Input
          id="setup-admin-account-name"
          placeholder="Minha Empresa"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          disabled={submitting}
        />
        <p className="text-muted-foreground text-xs">
          Identifica a primeira conta da plataforma — você pode renomear depois em Configurações.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Para entender a adoção do projeto, esta instância envia telemetria anônima e agregada (versão,
        contagem de usuários/contas, ambiente) — nunca e-mails, conteúdo de mensagens ou dados de contatos.
        Os dados agregados são públicos em{' '}
        <a
          href="https://telemetry.etus.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          telemetry.etus.dev
        </a>
        . Você pode desativar a qualquer momento via{' '}
        <code className="text-foreground">ETUS_TELEMETRY_ENABLED=false</code>. Saiba mais na{' '}
        <a
          href="https://telemetry.etus.dev/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          política de privacidade
        </a>
        .
      </p>

      <div className="mt-2 flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Criando...' : 'Criar e continuar'}
        </Button>
      </div>
    </form>
  );
}
