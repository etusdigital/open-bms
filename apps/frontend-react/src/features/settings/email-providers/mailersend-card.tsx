import { useTranslation } from 'react-i18next';
import { ProviderCard } from './provider-card';
import { accountMailersendGateway } from './mailersend-account-gateway';

interface MailersendCardProps {
  onChange?: () => void;
  id?: string;
  isDefault?: boolean;
  onAttemptRemoveDefault?: () => void;
}

export function MailersendCard({ onChange, id, isDefault, onAttemptRemoveDefault }: MailersendCardProps) {
  const { t } = useTranslation();
  return (
    <ProviderCard
      providerName="mailersend"
      providerLabel="MailerSend"
      apiKeyConfig={{
        placeholder: 'mlsn.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        prefix: 'mlsn.',
        minLength: 30,
        helperText: t('settings.mailersendApiKeyHelp'),
      }}
      gateway={accountMailersendGateway}
      onChange={onChange}
      id={id}
      isDefault={isDefault}
      onAttemptRemoveDefault={onAttemptRemoveDefault}
    />
  );
}
