import { useState, type FormEvent, type KeyboardEvent } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose IPv4/IPv6 client-side check; backend re-validates with Joi.
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

export function Step5Pool({ onComplete, onBack }: Props) {
  const [accountName, setAccountName] = useState('');
  const [poolName, setPoolName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [sendingLimit, setSendingLimit] = useState('1000');
  const [ipInput, setIpInput] = useState('');
  const [ips, setIps] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addIp() {
    const v = ipInput.trim();
    if (!v) return;
    if (!IPV4_RE.test(v) && !IPV6_RE.test(v)) {
      setError('IP inválido.');
      return;
    }
    if (ips.includes(v)) {
      setIpInput('');
      return;
    }
    setError(null);
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
    // Backend (advance-step.dto.ts:104-117) requires only `accountName`.
    // Pool name, sender, reply-to, and sending limit are optional. Validate
    // format only when the operator filled the field.
    if (!accountName.trim()) return 'Nome da conta obrigatório.';
    if (senderEmail && !EMAIL_RE.test(senderEmail)) return 'E-mail remetente inválido.';
    if (replyToEmail && !EMAIL_RE.test(replyToEmail)) return 'Reply-to inválido.';
    if (sendingLimit) {
      const limit = Number(sendingLimit);
      if (!Number.isInteger(limit) || limit < 1) return 'Limite diário inválido.';
    }
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
        step: 5,
        data: {
          accountName: accountName.trim(),
          ...(poolName.trim() && { poolName: poolName.trim() }),
          ...(senderEmail.trim() && { senderEmail: senderEmail.trim().toLowerCase() }),
          ...(senderName.trim() && { senderName: senderName.trim() }),
          ...(replyToEmail.trim() && { replyToEmail: replyToEmail.trim().toLowerCase() }),
          ...(sendingLimit && { sendingLimit: Number(sendingLimit) }),
          ...(ips.length > 0 && { ips }),
        },
      });
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao criar pool e conta.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pool-account-name">Nome da conta</Label>
          <Input
            id="pool-account-name"
            placeholder="Minha Empresa"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pool-name">Nome do pool</Label>
          <Input
            id="pool-name"
            placeholder="Pool Principal"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pool-sender-email">E-mail remetente</Label>
          <Input
            id="pool-sender-email"
            type="email"
            placeholder="noreply@empresa.com"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pool-sender-name">Nome remetente</Label>
          <Input
            id="pool-sender-name"
            placeholder="Empresa"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pool-replyto">Reply-to</Label>
          <Input
            id="pool-replyto"
            type="email"
            placeholder="contato@empresa.com"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pool-limit">Limite diário de envios</Label>
          <Input
            id="pool-limit"
            type="number"
            placeholder="1000"
            value={sendingLimit}
            onChange={(e) => setSendingLimit(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pool-ips">IPs do pool</Label>
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
              id="pool-ips"
              placeholder="Digite um IP e pressione Enter"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={onIpKeyDown}
              onBlur={addIp}
              disabled={busy}
              className="h-7 flex-1 min-w-[160px] border-0 px-1 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          {submitting ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
    </form>
  );
}
