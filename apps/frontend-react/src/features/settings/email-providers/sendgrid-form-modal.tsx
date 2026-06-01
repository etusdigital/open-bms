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
// Mirror of SENDGRID_FROM_DOMAIN_PATTERN in the backend DTO (EVO-1466).
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

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
  const [fromDomain, setFromDomain] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  // In edit mode the key input is hidden by default (the stored key is kept) —
  // this also means no password field exists for the browser to autofill or
  // pop a saved-login menu over. It only appears when the user opts to rotate.
  const [changingKey, setChangingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state every time the dialog opens; in edit mode, prefill
  // the current domain + masked key so the user sees what is configured.
  useEffect(() => {
    if (!open) return;
    setApiKey('');
    setFromDomain('');
    setMaskedKey(null);
    setChangingKey(false);
    setShowApiKey(false);
    setTestResult(null);
    setError(null);
    setSaving(false);
    setTesting(false);
    if (mode === 'edit') {
      accountSendgridGateway
        .get(accountId)
        .then((s) => {
          setFromDomain(s.fromDomain ?? '');
          setMaskedKey(s.apiKeyMasked ?? null);
        })
        .catch(() => {/* leave blank; user can still fill it in */});
    }
  }, [open, mode, accountId]);

  // The key input is shown when creating, or when editing and the user clicked
  // "Trocar chave". When hidden, the stored key is kept untouched on save.
  const keyInputVisible = mode === 'create' || changingKey;

  function validateApiKey(): string | null {
    // No input shown → nothing to validate (stored key is kept).
    if (!keyInputVisible) return null;
    if (!apiKey.startsWith(SENDGRID_KEY_PREFIX)) return 'API Key precisa começar com "SG.".';
    if (apiKey.length < SENDGRID_KEY_MIN) return `API Key precisa ter ao menos ${SENDGRID_KEY_MIN} caracteres.`;
    return null;
  }
  function validateDomain(): string | null {
    if (!fromDomain.trim()) return 'Informe o domínio remetente.';
    if (!DOMAIN_PATTERN.test(fromDomain.trim())) return 'Domínio inválido (ex.: mail.suaempresa.com).';
    return null;
  }
  function validate(): string | null {
    return validateApiKey() ?? validateDomain();
  }
  const apiKeyValid = keyInputVisible && validateApiKey() === null;
  const formValid = validate() === null;

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

  function startChangingKey() {
    setChangingKey(true);
    setShowApiKey(false);
    setTestResult(null);
  }
  function cancelChangingKey() {
    setChangingKey(false);
    setApiKey('');
    setShowApiKey(false);
    setTestResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validation = validate();
    if (validation) { setError(validation); return; }
    setSaving(true);
    try {
      const payload: { apiKey?: string; fromDomain: string } = { fromDomain: fromDomain.trim() };
      if (keyInputVisible && apiKey.length > 0) payload.apiKey = apiKey;
      await accountSendgridGateway.save(accountId, payload);
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

            {keyInputVisible ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    id="sendgrid-api-key"
                    name="sendgrid-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                    // Suppress browser / password-manager autofill on the key field.
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    autoFocus={mode === 'create'}
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
                {mode === 'edit' && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={cancelChangingKey} data-testid="sendgrid-cancel-change-key">
                    Manter chave atual
                  </Button>
                )}
                <p className="text-muted-foreground text-xs">{t('settings.sendgridApiKeyHelp')}</p>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground font-mono text-sm" data-testid="sendgrid-masked-key">
                  {maskedKey ?? 'Chave configurada'}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={startChangingKey} data-testid="sendgrid-change-key">
                  Trocar chave
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sendgrid-from-domain">Domínio remetente</Label>
            <Input
              id="sendgrid-from-domain"
              type="text"
              value={fromDomain}
              placeholder="mail.suaempresa.com"
              onChange={(e) => setFromDomain(e.target.value)}
              autoComplete="off"
              data-testid="sendgrid-from-domain-input"
            />
            {fromDomain.length > 0 && validateDomain() ? (
              <p className="text-destructive text-xs" data-testid="sendgrid-from-domain-error">{validateDomain()}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Envios cuja From não pertença a este domínio usarão o remetente padrão da conta. Alterá-lo atualiza a configuração de envio.
              </p>
            )}
          </div>

          {keyInputVisible && (
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
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !formValid} data-testid="sendgrid-save-button">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
