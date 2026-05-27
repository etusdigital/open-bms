import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ListPage } from '@/components/list-page';
import { INTEGRATIONS_TABS, type IntegrationsTab } from './types';
import { SendgridPlatformTab } from './sendgrid-platform-tab';
import { S3Tab } from './s3-tab';
import { FcmTab } from './fcm-tab';
import { GeoIpTab } from './geoip-tab';
import { WhatsappMetaTab } from './whatsapp-meta-tab';
import { WhatsappHubTab } from './whatsapp-hub-tab';

const TAB_LABEL_KEY: Record<IntegrationsTab, string> = {
  sendgridPlatform: 'integrations.tabSendgridPlatform',
  s3: 'integrations.tabS3',
  fcm: 'integrations.tabFcm',
  geoip: 'integrations.tabGeoip',
  whatsappMeta: 'integrations.tabWhatsappMeta',
  whatsappHub: 'integrations.tabWhatsappHub',
};

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<IntegrationsTab>('sendgridPlatform');

  return (
    <ListPage.Root>
      <ListPage.Header title={t('integrations.pageTitle')} />

      <ListPage.Toolbar>
        <div className="flex items-center gap-2">
          {INTEGRATIONS_TABS.map((key) => (
            <Button
              key={key}
              variant={tab === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(key)}
            >
              {t(TAB_LABEL_KEY[key])}
            </Button>
          ))}
        </div>
      </ListPage.Toolbar>

      <ListPage.Content>
        <div className="p-6">
          {tab === 'sendgridPlatform' && <SendgridPlatformTab />}
          {tab === 's3' && <S3Tab />}
          {tab === 'fcm' && <FcmTab />}
          {tab === 'geoip' && <GeoIpTab />}
          {tab === 'whatsappMeta' && <WhatsappMetaTab />}
          {tab === 'whatsappHub' && <WhatsappHubTab />}
        </div>
      </ListPage.Content>
    </ListPage.Root>
  );
}
