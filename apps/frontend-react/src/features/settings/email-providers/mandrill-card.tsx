import { useTranslation } from 'react-i18next';
import { ProviderCard } from './provider-card';
import { accountMandrillGateway } from './mandrill-account-gateway';

interface MandrillCardProps {
  onChange?: () => void;
  id?: string;
  isDefault?: boolean;
  onAttemptRemoveDefault?: () => void;
}

export function MandrillCard({ onChange, id, isDefault, onAttemptRemoveDefault }: MandrillCardProps) {
  const { t } = useTranslation();
  return (
    <ProviderCard
      providerName="mandrill"
      providerLabel="Mandrill"
      apiKeyConfig={{
        placeholder: 'xxxxxxxxxxxxxxxx',
        minLength: 16,
        helperText: t('settings.mandrillApiKeyHelp'),
      }}
      gateway={accountMandrillGateway}
      banner={{ variant: 'warning', text: t('settings.mandrillDiscontinuationWarning') }}
      onChange={onChange}
      id={id}
      isDefault={isDefault}
      onAttemptRemoveDefault={onAttemptRemoveDefault}
    />
  );
}
