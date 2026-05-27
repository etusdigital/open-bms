import { useTranslation } from 'react-i18next';
import { ProviderCard } from './provider-card';
import { accountSparkpostGateway } from './sparkpost-account-gateway';

interface SparkpostCardProps {
  onChange?: () => void;
  id?: string;
  isDefault?: boolean;
  onAttemptRemoveDefault?: () => void;
}

export function SparkpostCard({ onChange, id, isDefault, onAttemptRemoveDefault }: SparkpostCardProps) {
  const { t } = useTranslation();
  return (
    <ProviderCard
      providerName="sparkpost"
      providerLabel="SparkPost"
      apiKeyConfig={{
        placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        minLength: 30,
        helperText: t('settings.sparkpostApiKeyHelp'),
      }}
      gateway={accountSparkpostGateway}
      onChange={onChange}
      id={id}
      isDefault={isDefault}
      onAttemptRemoveDefault={onAttemptRemoveDefault}
    />
  );
}
