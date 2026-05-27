import { useTranslation } from 'react-i18next';
import { ProviderCard } from './provider-card';
import { accountResendGateway } from './resend-account-gateway';

interface ResendCardProps {
  onChange?: () => void;
  id?: string;
  isDefault?: boolean;
  onAttemptRemoveDefault?: () => void;
}

export function ResendCard({ onChange, id, isDefault, onAttemptRemoveDefault }: ResendCardProps) {
  const { t } = useTranslation();
  return (
    <ProviderCard
      providerName="resend"
      providerLabel="Resend"
      apiKeyConfig={{
        placeholder: 're_xxxxxxxxxxxxxxxxxxxxxxxxxx',
        prefix: 're_',
        minLength: 20,
        helperText: t('settings.resendApiKeyHelp'),
      }}
      gateway={accountResendGateway}
      onChange={onChange}
      id={id}
      isDefault={isDefault}
      onAttemptRemoveDefault={onAttemptRemoveDefault}
    />
  );
}
