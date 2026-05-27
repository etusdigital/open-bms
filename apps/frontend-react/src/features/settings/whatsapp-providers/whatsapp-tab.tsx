import { useTranslation } from 'react-i18next';
import { useEvolutionHubEnabled } from '@/features/feature-flags/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelsList, HubConnectButton, MetaConnectButton } from '@/features/whatsapp-channels';
import { useAccountId } from '../use-settings';

/**
 * Wave 7.4 — Settings → WhatsApp tab with functional connect flow.
 *
 * - Card "Modo de instalação" mirrors the install-wide flag (Meta direct
 *   vs EvoHub) so admins know which connect path will run.
 * - The connect card hosts MetaConnectButton (FB.login + Embedded Signup)
 *   or HubConnectButton (public_link in a new tab) depending on the flag.
 * - The list card is always visible and refreshes when channels are added
 *   or deleted; pending EvoHub channels poll status until they flip.
 */
export function WhatsAppTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const { enabled, isLoading, isError } = useEvolutionHubEnabled();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('settings.whatsapp.installModeTitle')}
            {isLoading ? <Skeleton className="h-5 w-20" /> : <Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? t('settings.whatsapp.modeHub') : t('settings.whatsapp.modeMeta')}</Badge>}
          </CardTitle>
          <CardDescription>{t('settings.whatsapp.installModeDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t('settings.whatsapp.flagsErrorTitle')}</AlertTitle>
              <AlertDescription>{t('settings.whatsapp.flagsErrorBody')}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-48" />
            </div>
          ) : enabled ? (
            <>
              <p className="text-sm">{t('settings.whatsapp.hubDescription')}</p>
              <HubConnectButton accountId={accountId} />
            </>
          ) : (
            <>
              <p className="text-sm">{t('settings.whatsapp.metaDescription')}</p>
              <MetaConnectButton accountId={accountId} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.whatsapp.channelsTitle')}</CardTitle>
          <CardDescription>{t('settings.whatsapp.channelsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelsList accountId={accountId} />
        </CardContent>
      </Card>
    </div>
  );
}
