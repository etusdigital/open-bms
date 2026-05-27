import { useTranslation } from 'react-i18next';
import { useEvolutionHubEnabled } from '@/features/feature-flags/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelsList, HubConnectButton, MetaConnectButton, useWhatsappChannels } from '@/features/whatsapp-channels';
import { useAccountId } from '../use-settings';

/**
 * Wave 7.4 — Settings → WhatsApp tab with functional connect flow.
 *
 * - Card "Modo de instalação" mirrors the install-wide flag (Meta direct
 *   vs EvoHub) so admins know which connect path will run.
 * - In EvoHub mode the connect button is hidden when there is already a
 *   live channel (active or pending), enforcing the single-channel rule:
 *   the only way to reconnect is delete + create again. In Meta mode
 *   multiple numbers / channels are allowed.
 * - The list card is always visible and refreshes when channels are
 *   added or deleted.
 */
export function WhatsAppTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const { enabled, isLoading, isError } = useEvolutionHubEnabled();
  const { data: channels } = useWhatsappChannels(accountId);

  const hasLiveHubChannel = !!channels?.some((c) => c.mode === 'evohub' && (c.status === 'active' || c.status === 'pending'));

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
            hasLiveHubChannel ? (
              <Alert>
                <AlertTitle>{t('settings.whatsapp.hubAlreadyConnectedTitle')}</AlertTitle>
                <AlertDescription>{t('settings.whatsapp.hubAlreadyConnectedBody')}</AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm">{t('settings.whatsapp.hubDescription')}</p>
                <HubConnectButton accountId={accountId} />
              </>
            )
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
