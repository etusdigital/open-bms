import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAccountId, useUpdateAccountConfigs } from '../use-settings';
import { useEmailProviders } from './use-email-providers';

export function DefaultEmailProviderSection() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const { providers, defaultProvider } = useEmailProviders();
  const updateConfigs = useUpdateAccountConfigs();
  const [selected, setSelected] = useState<string>(defaultProvider ?? '');

  useEffect(() => {
    setSelected(defaultProvider ?? '');
  }, [defaultProvider]);

  function handleSave() {
    if (!selected) return;
    updateConfigs.mutate({
      accountId,
      configs: [{ account_id: accountId, name: 'default_email_provider', value: selected }],
    });
  }

  return (
    <TooltipProvider>
      <div className="max-w-lg space-y-3">
        <div>
          <Label className="text-base font-medium">{t('settings.defaultEmailProviderTitle')}</Label>
          <p className="text-muted-foreground mt-1 text-xs">{t('settings.defaultEmailProviderHelp')}</p>
        </div>

        <div role="radiogroup" className="flex flex-col gap-2">
          {providers.map((provider) => {
            const isSelected = selected === provider.name;
            const button = (
              <button
                key={provider.name}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!provider.configured}
                onClick={() => provider.configured && setSelected(provider.name)}
                className={[
                  'flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm',
                  isSelected ? 'border-primary bg-primary/5' : 'border-input',
                  provider.configured ? 'hover:bg-muted cursor-pointer' : 'cursor-not-allowed opacity-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded-full border',
                    isSelected ? 'border-primary' : 'border-input',
                  ].join(' ')}
                >
                  {isSelected && <span className="bg-primary h-2 w-2 rounded-full" />}
                </span>
                <span>{provider.label}</span>
              </button>
            );
            if (provider.configured) return button;
            return (
              <Tooltip key={provider.name}>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{button}</span>
                </TooltipTrigger>
                <TooltipContent>{t('settings.defaultEmailProviderNotConfiguredTooltip')}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {selected === 'ses' && (
          <Alert variant="warning" data-testid="default-provider-ses-warning">
            <AlertDescription>{t('settings.defaultProviderSesWarning')}</AlertDescription>
          </Alert>
        )}
        {selected === 'mandrill' && (
          <Alert variant="warning" data-testid="default-provider-mandrill-warning">
            <AlertDescription>{t('settings.defaultProviderMandrillWarning')}</AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          size="sm"
          disabled={!selected || updateConfigs.isPending || selected === defaultProvider}
          onClick={handleSave}
        >
          {updateConfigs.isPending ? t('common.loading') : t('settings.defaultEmailProviderSave')}
        </Button>
      </div>
    </TooltipProvider>
  );
}
