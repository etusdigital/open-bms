import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupGateway } from '@/features/setup/setup-gateway';

interface Props {
  onComplete: () => void;
  onBack?: () => void;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function Step3Domain({ onComplete, onBack }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isValidUrl(baseUrl.trim())) {
      setError('URL inválida. Ex: https://app.empresa.com');
      return;
    }
    setSubmitting(true);
    try {
      await setupGateway.advanceStep({ step: 3, data: { baseUrl: baseUrl.trim() } });
      // SendGrid (4) and IP Pool (5) are hidden in this UI — auto-skip both on
      // the backend so the wizard's currentStep advances straight to 6 (Health).
      try {
        await setupGateway.advanceStep({ step: 4, data: { skip: true } });
      } catch {
        // Idempotent on the backend; if it has already been skipped (e.g. user
        // refreshed mid-flow), the next advance call will succeed anyway.
      }
      try {
        await setupGateway.advanceStep({ step: 5, data: { skip: true } });
      } catch {
        // Idempotent.
      }
      onComplete();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Erro ao salvar URL base.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-base-url">URL base da plataforma</Label>
        <Input
          id="setup-base-url"
          autoFocus
          placeholder="https://app.empresa.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          disabled={submitting}
        />
        <p className="text-muted-foreground text-xs">
          Usada em links de e-mails, redirecionamentos e integrações externas.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" disabled={submitting} onClick={onBack}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
    </form>
  );
}
