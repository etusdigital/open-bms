import { useTranslation } from 'react-i18next';
import { WebPushSection } from './web-push-section';

// Single-project model: Firebase (web + mobile) is configured once by the
// super-admin in Integrations → FCM. The account screen only handles web-push
// site integration (download SW, install snippet, opt-in popup, URL filters).
// No per-account Firebase service account here — it was unused in production and
// removed to avoid the "two JSONs in two places" confusion.
export function PushTab() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-lg font-medium">{t('settings.pushTitle') ?? 'Push Notification'}</h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.pushAccountHelp') ??
            'Configure o push do seu site abaixo. As credenciais Firebase (envio) são gerenciadas pela plataforma — você não precisa configurá-las aqui.'}
        </p>
      </div>
      <WebPushSection />
    </div>
  );
}
