import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccountId, useRefreshAccountConfigs } from '../use-settings';
import { accountSendgridGateway } from './sendgrid-account-gateway';

const SENDGRID_KEY_MIN = 50;
const SENDGRID_KEY_PREFIX = 'SG.';

interface SendgridFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function SendgridFormModal({ open, mode, onOpenChange, onSaved }: SendgridFormModalProps) {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const refreshAccountConfigs = useRefreshAccountConfigs();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setApiKey('');
    setShowApiKey(false);
    setTestResult(null);
    setError(null);
    setSaving(false);
    setTesting(false);
  }, [open]);

  function validate(): string | null {
    if (!apiKey.startsWith(SENDGRID_KEY_PREFIX)) return 'API Key precisa começar com "SG.".';
    if (apiKey.length < SENDGRID_KEY_MIN) return `API Key precisa ter ao menos ${SENDGRID_KEY_MIN} caracteres.`;
    return null;
  }
  const apiKeyValid = validate() === null;

  async function handleTest() {
    setTestResult(null);
    setTesting(true);
    try {
      const res = await accountSendgridGateway.test(accountId, apiKey);
      if (res.ok) setTestResult({ ok: true, message: 'Conexão bem-sucedida.' });
      else setTestResult({ ok: false, message: res.errorMessage ?? 'Falha ao testar conexão.' });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setTestResult({
        ok: false,
        message: status === 429
          ? 'Muitas tentativas de teste. Aguarde um minuto e tente novamente.'
          : 'Erro inesperado ao testar conexão.',
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validation = validate();
    if (validation) { setError(validation); return; }
    setSaving(true);
    try {
      await accountSendgridGateway.save(accountId, { apiKey });
      // Backend auto-promotes the first configured provider to default; the
      // store's `default_email_provider` would otherwise stay stale until
      // next login.
      await refreshAccountConfigs();
      toast.success(mode === 'create' ? 'SendGrid configurado. Webhook ativo.' : 'Configurações SendGrid atualizadas.');
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? 'Erro ao salvar configurações SendGrid.');
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" data-testid="sendgrid-form-modal">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Adicionar SendGrid' : 'Editar SendGrid'}</DialogTitle>
          <DialogDescription>
            Ao salvar, o webhook de eventos será configurado automaticamente na sua conta SendGrid.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="sendgrid-form">
          <div className="space-y-2">
            <Label htmlFor="sendgrid-api-key">API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="sendgrid-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                autoComplete="off"
                autoFocus
                data-testid="sendgrid-api-key-input"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey((v) => !v)}
                aria-label={showApiKey ? 'Ocultar API key' : 'Mostrar API key'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{t('settings.sendgridApiKeyHelp')}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !apiKeyValid} data-testid="sendgrid-test-button">
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Testar conexão
            </Button>
            {testResult && (
              <span className={testResult.ok ? 'text-sm text-green-600' : 'text-destructive text-sm'} data-testid="sendgrid-test-result">
                {testResult.message}
              </span>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !apiKeyValid} data-testid="sendgrid-save-button">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
