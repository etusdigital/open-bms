import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/query-keys';
import { whatsappChannelsService } from './api';

interface Props {
  accountId: number;
}

/**
 * Wave 7.4 — "Conectar via EvoHub" button.
 *
 * 1. POSTs the channel with mode='evohub' (backend hits the Hub and persists
 *    the pending row).
 * 2. Opens the returned `public_link` in a new tab so the admin completes
 *    Embedded Signup hosted by the Hub.
 * 3. Refreshes the channel list — the row appears as `pending` and is
 *    polled via useChannelStatusPolling until the Hub webhook flips it
 *    to `active`.
 */
export function HubConnectButton({ accountId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('WhatsApp Principal');
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!name.trim()) {
      toast.error(t('whatsappChannels.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const channel = await whatsappChannelsService.create(accountId, { mode: 'evohub', name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.whatsappChannels.list(accountId) });

      if (channel.publicLink) {
        // Note: opening synchronously after the network call may still be
        // blocked by some browsers because we lost the user-gesture window.
        // The fallback message tells the user to click the channel row's
        // "Continue signup" link in the list — handled by the list UI.
        window.open(channel.publicLink, '_blank', 'noopener,noreferrer');
        toast.success(t('whatsappChannels.hubOpenedSignup'));
      } else {
        toast.warning(t('whatsappChannels.hubNoPublicLink'));
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('whatsappChannels.connectError');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="wa-channel-name">{t('whatsappChannels.channelName')}</Label>
        <Input id="wa-channel-name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} maxLength={255} />
        <p className="text-muted-foreground text-xs">{t('whatsappChannels.channelNameHelp')}</p>
      </div>
      <Button size="lg" disabled={submitting} onClick={handleClick}>
        {submitting ? t('common.loading') : t('whatsappChannels.hubButton')}
      </Button>
    </div>
  );
}
