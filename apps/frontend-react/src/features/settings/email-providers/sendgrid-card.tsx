import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccountId } from '../use-settings';
import { ProviderCard } from './provider-card';
import { accountSendgridGateway } from './sendgrid-account-gateway';

interface SendgridCardProps {
  onChange?: () => void;
  id?: string;
  onAttemptRemoveDefault?: () => void;
  isDefault?: boolean;
}

export function SendgridCard({ onChange, id, onAttemptRemoveDefault, isDefault }: SendgridCardProps) {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    accountSendgridGateway
      .get(accountId)
      .then((value) => {
        if (cancelled) return;
        setWebhookUrl(value.webhookUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setWebhookUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  function handleCopy() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const footer = webhookUrl ? (
    <div className="flex flex-col gap-1.5" data-testid="sendgrid-webhook-footer">
      <Label>{t('settings.sendgridWebhook')}</Label>
      <div className="flex items-center gap-2">
        <Input value={webhookUrl} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} aria-label="Copiar webhook">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t('settings.sendgridWebhookHelp')}</p>
    </div>
  ) : null;

  return (
    <ProviderCard
      providerName="sendgrid"
      providerLabel="SendGrid"
      apiKeyConfig={{
        placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        prefix: 'SG.',
        minLength: 50,
        helperText: t('settings.sendgridApiKeyHelp'),
      }}
      gateway={accountSendgridGateway}
      footerSlot={footer}
      id={id}
      onChange={() => {
        accountSendgridGateway
          .get(accountId)
          .then((v) => setWebhookUrl(v.webhookUrl))
          .catch(() => {});
        onChange?.();
      }}
      onAttemptRemoveDefault={onAttemptRemoveDefault}
      isDefault={isDefault}
    />
  );
}
