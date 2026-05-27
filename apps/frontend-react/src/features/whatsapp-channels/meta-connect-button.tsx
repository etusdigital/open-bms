import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFeatureFlags } from '@/features/feature-flags/api';
import { queryKeys } from '@/lib/query-keys';
import { whatsappChannelsService } from './api';
import { useFbSdk, type FBLoginResponse } from './use-fb-sdk';

interface EmbeddedSignupPayload {
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
}

interface Props {
  accountId: number;
}

/**
 * Wave 7.4 — "Entrar com Facebook" button for direct Meta mode.
 *
 * Triggers FB.login with `config_id` (Embedded Signup), captures the
 * `phone_number_id` / `waba_id` / `business_id` via Meta's postMessage and
 * the `code` via the FB.login callback, then POSTs the channel.
 */
export function MetaConnectButton({ accountId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: flags } = useFeatureFlags();
  const appId = flags?.whatsapp_app_id ?? '';
  const configId = flags?.whatsapp_config_id ?? '';
  const graphVersion = flags?.whatsapp_graph_version ?? 'v18.0';
  const { fb, ready, error: sdkError } = useFbSdk(appId, graphVersion);

  const [name, setName] = useState('WhatsApp Principal');
  const [submitting, setSubmitting] = useState(false);

  const isConfigured = !!appId && !!configId;

  function handleClick() {
    if (!fb) return;
    if (!name.trim()) {
      toast.error(t('whatsappChannels.nameRequired'));
      return;
    }

    // Listen for the Embedded Signup postMessage before opening FB.login —
    // the message can arrive before the FB.login callback fires.
    const captured: EmbeddedSignupPayload = {};
    const messageListener = (ev: MessageEvent) => {
      if (!ev.origin.includes('facebook.com')) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH' && data?.data) {
          captured.phone_number_id = data.data.phone_number_id;
          captured.waba_id = data.data.waba_id;
          captured.business_id = data.data.business_id;
        }
      } catch {
        // not our message — ignore
      }
    };
    window.addEventListener('message', messageListener);

    fb.login(
      async (response: FBLoginResponse) => {
        window.removeEventListener('message', messageListener);
        const code = response?.authResponse?.code;
        if (!code) {
          toast.error(t('whatsappChannels.loginCancelled'));
          return;
        }
        if (!captured.phone_number_id || !captured.waba_id) {
          toast.error(t('whatsappChannels.embeddedSignupIncomplete'));
          return;
        }

        setSubmitting(true);
        try {
          await whatsappChannelsService.create(accountId, {
            mode: 'meta',
            name: name.trim(),
            code,
            phone_number_id: captured.phone_number_id,
            waba_id: captured.waba_id,
            business_id: captured.business_id,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.whatsappChannels.list(accountId) });
          toast.success(t('whatsappChannels.connectedOk'));
        } catch (err) {
          const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('whatsappChannels.connectError');
          toast.error(msg);
        } finally {
          setSubmitting(false);
        }
      },
      { config_id: configId, response_type: 'code', override_default_response_type: true },
    );
  }

  if (!isConfigured) {
    return (
      <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-xs dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">{t('whatsappChannels.metaNotConfiguredTitle')}</p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">{t('whatsappChannels.metaNotConfiguredBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="wa-channel-name">{t('whatsappChannels.channelName')}</Label>
        <Input id="wa-channel-name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} maxLength={255} />
        <p className="text-muted-foreground text-xs">{t('whatsappChannels.channelNameHelp')}</p>
      </div>
      {sdkError && (
        <p className="text-sm text-red-500" role="alert">
          {sdkError}
        </p>
      )}
      <Button size="lg" disabled={!ready || submitting} onClick={handleClick} className="bg-[#1877f2] text-white hover:bg-[#1877f2]/90">
        {submitting ? t('common.loading') : ready ? t('whatsappChannels.metaButton') : t('whatsappChannels.loadingSdk')}
      </Button>
    </div>
  );
}
