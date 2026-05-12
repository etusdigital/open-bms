import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useAccountId, useAccountConfig } from '../use-settings';
import { accountSendgridGateway } from './sendgrid-account-gateway';
import { accountMailersendGateway } from './mailersend-account-gateway';
import { accountSparkpostGateway } from './sparkpost-account-gateway';
import { accountResendGateway } from './resend-account-gateway';
import { accountSesGateway } from './amazon-ses-account-gateway';
import { accountMandrillGateway } from './mandrill-account-gateway';

interface ProviderRegistration {
  name: string;
  label: string;
  hasFreeTier: boolean;
  hasWebhook: boolean;
  notes?: string;
  get: (accountId: number) => Promise<{ source: 'account' | 'none' }>;
}

const PROVIDERS: ProviderRegistration[] = [
  { name: 'sendgrid', label: 'SendGrid', hasFreeTier: false, hasWebhook: true, get: (id) => accountSendgridGateway.get(id) },
  { name: 'mailersend', label: 'MailerSend', hasFreeTier: true, hasWebhook: true, get: (id) => accountMailersendGateway.get(id) },
  { name: 'sparkpost', label: 'SparkPost', hasFreeTier: true, hasWebhook: true, get: (id) => accountSparkpostGateway.get(id) },
  { name: 'resend', label: 'Resend', hasFreeTier: true, hasWebhook: true, get: (id) => accountResendGateway.get(id) },
  { name: 'ses', label: 'Amazon SES', hasFreeTier: false, hasWebhook: true, notes: 'Free tier exige EC2', get: (id) => accountSesGateway.get(id) },
  { name: 'mandrill', label: 'Mandrill', hasFreeTier: false, hasWebhook: true, notes: 'Experimental', get: (id) => accountMandrillGateway.get(id) },
];

export interface ProviderState {
  name: string;
  label: string;
  configured: boolean;
  hasFreeTier: boolean;
  hasWebhook: boolean;
  notes?: string;
}

export function useEmailProviders() {
  const accountId = useAccountId();
  const defaultProvider = useAccountConfig('default_email_provider');
  const qc = useQueryClient();

  const queries = useQueries({
    queries: PROVIDERS.map((p) => ({
      queryKey: ['email-providers', accountId, p.name],
      queryFn: () => p.get(accountId),
      staleTime: 30_000,
      enabled: !!accountId,
    })),
  });

  const providers: ProviderState[] = PROVIDERS.map((p, i) => {
    const data = queries[i].data;
    const configured = !!data && data.source === 'account';
    return {
      name: p.name,
      label: p.label,
      configured,
      hasFreeTier: p.hasFreeTier,
      hasWebhook: p.hasWebhook,
      notes: p.notes,
    };
  });

  const configuredProviders = useMemo(() => providers.filter((p) => p.configured), [providers]);
  const hasAnyConfigured = configuredProviders.length > 0;

  const isLoading = queries.some((q) => q.isLoading);
  const refresh = () => qc.invalidateQueries({ queryKey: ['email-providers', accountId] });

  return { providers, configuredProviders, hasAnyConfigured, defaultProvider, isLoading, refresh };
}
