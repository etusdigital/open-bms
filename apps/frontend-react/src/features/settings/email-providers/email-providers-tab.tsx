import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAccountId, useUpdateAccountConfigs } from '../use-settings';
import { DefaultEmailProviderSection } from './default-email-provider-section';
import { FirstTimeWizard } from './first-time-wizard';
import { MailersendCard } from './mailersend-card';
import { SparkpostCard } from './sparkpost-card';
import { ResendCard } from './resend-card';
import { SendgridCard } from './sendgrid-card';
import { AmazonSesCard } from './amazon-ses-card';
import { MandrillCard } from './mandrill-card';
import { RemoveDefaultConfirmDialog } from './remove-default-confirm-dialog';
import { SparkpostLegacyMigration } from './sparkpost-legacy-migration';
import { useEmailProviders } from './use-email-providers';
import { mapProviderError } from './provider-error-toast';
import { accountMailersendGateway } from './mailersend-account-gateway';
import { accountSparkpostGateway } from './sparkpost-account-gateway';
import { accountResendGateway } from './resend-account-gateway';
import { accountMandrillGateway } from './mandrill-account-gateway';
import { accountSesGateway } from './amazon-ses-account-gateway';
import { accountSendgridGateway } from './sendgrid-account-gateway';

const PROVIDER_CARD_DOM_ID = (provider: string) => `email-provider-card-${provider}`;
const wizardDismissKey = (accountId: number) => `email-providers:wizard-dismissed:${accountId}`;

function readDismissed(accountId: number): boolean {
  if (typeof window === 'undefined' || !accountId) return false;
  try {
    return window.sessionStorage.getItem(wizardDismissKey(accountId)) === '1';
  } catch {
    return false;
  }
}

const PROVIDER_REMOVERS: Record<string, { label: string; remove: (accountId: number) => Promise<void> }> = {
  mailersend: { label: 'MailerSend', remove: (id) => accountMailersendGateway.remove(id) },
  sparkpost: { label: 'SparkPost', remove: (id) => accountSparkpostGateway.remove(id) },
  resend: { label: 'Resend', remove: (id) => accountResendGateway.remove(id) },
  sendgrid: { label: 'SendGrid', remove: (id) => accountSendgridGateway.remove(id) },
  mandrill: { label: 'Mandrill', remove: (id) => accountMandrillGateway.remove(id) },
  ses: { label: 'Amazon SES', remove: (id) => accountSesGateway.remove(id) },
};

export function EmailProvidersTab() {
  const accountId = useAccountId();
  const { configuredProviders, defaultProvider, hasAnyConfigured, isLoading, refresh } = useEmailProviders();
  const updateConfigs = useUpdateAccountConfigs();

  const showSetupBanner = !isLoading && !defaultProvider && !hasAnyConfigured;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  const removeTargetLabel = useMemo(
    () => (removeTarget ? PROVIDER_REMOVERS[removeTarget]?.label ?? removeTarget : ''),
    [removeTarget],
  );

  useEffect(() => {
    if (isLoading || !accountId) return;
    if (hasAnyConfigured) {
      setWizardOpen(false);
      return;
    }
    setWizardOpen(!readDismissed(accountId));
  }, [isLoading, accountId, hasAnyConfigured]);

  function handleWizardSelect(providerName: string) {
    setWizardOpen(false);
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      const node = document.getElementById(PROVIDER_CARD_DOM_ID(providerName));
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = node.querySelector<HTMLInputElement>(`#account-${providerName}-apikey`);
      input?.focus();
    });
  }

  function handleWizardSkip() {
    setWizardOpen(false);
    if (typeof window === 'undefined' || !accountId) return;
    try {
      window.sessionStorage.setItem(wizardDismissKey(accountId), '1');
    } catch {
      /* sessionStorage may be unavailable; non-fatal */
    }
  }

  function openRemoveDefaultDialog(providerName: string) {
    setRemoveTarget(providerName);
  }

  function closeRemoveDefaultDialog() {
    if (removeSubmitting) return;
    setRemoveTarget(null);
  }

  async function handleConfirmRemoveDefault(newDefault: string) {
    if (!removeTarget) return;
    const remover = PROVIDER_REMOVERS[removeTarget];
    if (!remover) {
      setRemoveTarget(null);
      return;
    }

    setRemoveSubmitting(true);
    try {
      await updateConfigs.mutateAsync({
        accountId,
        configs: [{ account_id: accountId, name: 'default_email_provider', value: newDefault }],
      });
    } catch {
      // useUpdateAccountConfigs.onError already surfaced the error toast (cross-field 400 included).
      setRemoveSubmitting(false);
      return;
    }

    try {
      await remover.remove(accountId);
      toast.success(`${remover.label} removido.`);
      refresh();
      setRemoveTarget(null);
    } catch (err) {
      toast.error(mapProviderError(err, remover.label));
    } finally {
      setRemoveSubmitting(false);
    }
  }

  const isDefault = (name: string) => defaultProvider === name;
  const triggerRemoveDefault = (name: string) => () => openRemoveDefaultDialog(name);

  return (
    <div className="space-y-6">
      {showSetupBanner && (
        <Alert variant="warning" data-testid="email-providers-setup-banner">
          <AlertDescription>
            Configure pelo menos um email provider para enviar campanhas a partir desta conta.
          </AlertDescription>
        </Alert>
      )}
      <SparkpostLegacyMigration />
      <DefaultEmailProviderSection />
      <Separator />
      <div className="grid gap-6 lg:grid-cols-2">
        <MailersendCard
          onChange={refresh}
          id={PROVIDER_CARD_DOM_ID('mailersend')}
          isDefault={isDefault('mailersend')}
          onAttemptRemoveDefault={triggerRemoveDefault('mailersend')}
        />
        <SparkpostCard
          onChange={refresh}
          id={PROVIDER_CARD_DOM_ID('sparkpost')}
          isDefault={isDefault('sparkpost')}
          onAttemptRemoveDefault={triggerRemoveDefault('sparkpost')}
        />
        <ResendCard
          onChange={refresh}
          id={PROVIDER_CARD_DOM_ID('resend')}
          isDefault={isDefault('resend')}
          onAttemptRemoveDefault={triggerRemoveDefault('resend')}
        />
        <SendgridCard
          onChange={refresh}
          id={PROVIDER_CARD_DOM_ID('sendgrid')}
          isDefault={isDefault('sendgrid')}
          onAttemptRemoveDefault={triggerRemoveDefault('sendgrid')}
        />
        <MandrillCard
          onChange={refresh}
          id={PROVIDER_CARD_DOM_ID('mandrill')}
          isDefault={isDefault('mandrill')}
          onAttemptRemoveDefault={triggerRemoveDefault('mandrill')}
        />
        <AmazonSesCard
          onChange={refresh}
          id={PROVIDER_CARD_DOM_ID('ses')}
          isDefault={isDefault('ses')}
          onAttemptRemoveDefault={triggerRemoveDefault('ses')}
        />
      </div>

      <FirstTimeWizard
        open={wizardOpen}
        onOpenChange={(v) => {
          if (!v) handleWizardSkip();
        }}
        onSelect={handleWizardSelect}
        onSkip={handleWizardSkip}
      />

      <RemoveDefaultConfirmDialog
        open={removeTarget != null}
        providerBeingRemoved={removeTarget ?? ''}
        providerBeingRemovedLabel={removeTargetLabel}
        defaultProvider={defaultProvider ?? null}
        configuredProviders={configuredProviders}
        onConfirm={handleConfirmRemoveDefault}
        onCancel={closeRemoveDefaultDialog}
        submitting={removeSubmitting}
      />
    </div>
  );
}
