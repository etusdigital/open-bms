import { useTranslation } from 'react-i18next';
import { useEvolutionHubEnabled } from '@/features/feature-flags/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Wave 7.3 — Settings → WhatsApp tab (preview).
 *
 * Mirrors the per-account configuration model used by Email Providers: each
 * account manages its own WhatsApp channels from this tab. The flag-driven
 * branch (Meta direct vs EvoHub) is install-wide; the channels themselves
 * are per-account.
 *
 * Buttons are disabled placeholders for Wave 7.4 — once channel CRUD,
 * MetaConnectButton (FB SDK) and HubConnectButton (public_link polling)
 * land, they take over.
 */
export function WhatsAppTab() {
  const { t } = useTranslation();
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
            <HubModePreview />
          ) : (
            <MetaModePreview />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.whatsapp.channelsTitle')}</CardTitle>
          <CardDescription>{t('settings.whatsapp.channelsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm italic">{t('settings.whatsapp.channelsEmpty')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetaModePreview() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm">{t('settings.whatsapp.metaDescription')}</p>
      <Button size="lg" disabled className="bg-[#1877f2] text-white hover:bg-[#1877f2]/90">
        {t('settings.whatsapp.metaButton')}
      </Button>
      <p className="text-muted-foreground text-xs">{t('settings.whatsapp.metaButtonHint')}</p>
    </div>
  );
}

function HubModePreview() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm">{t('settings.whatsapp.hubDescription')}</p>
      <Button size="lg" disabled>
        {t('settings.whatsapp.hubButton')}
      </Button>
      <p className="text-muted-foreground text-xs">{t('settings.whatsapp.hubButtonHint')}</p>
    </div>
  );
}
