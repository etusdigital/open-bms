import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryKeys } from '@/lib/query-keys';
import { whatsappChannelsService, type HubChannelOption } from './api';

interface Props {
  accountId: number;
}

/**
 * Wave 7.4 — EvoHub connection panel.
 *
 * Two paths share the same panel:
 *
 *  - "Conectar novo canal": runs Embedded Signup on EvoHub (POST /channels
 *    with mode='evohub', open public_link).
 *  - "Usar canal existente": skips signup and just creates the BMS webhook
 *    against an already-connected Hub channel (POST attach-existing).
 *
 * Single-channel-per-account rule applies to both — either path consumes
 * the slot. The picker disables channels we already track locally.
 */
export function HubConnectButton({ accountId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // --- Path A: new channel via Embedded Signup ---
  const [name, setName] = useState('WhatsApp Principal');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateNew() {
    if (!name.trim()) {
      toast.error(t('whatsappChannels.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const channel = await whatsappChannelsService.create(accountId, { mode: 'evohub', name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.whatsappChannels.list(accountId) });

      if (channel.publicLink) {
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

  // --- Path B: attach to an existing channel ---
  const hubChannelsQuery = useQuery({
    queryKey: queryKeys.whatsappChannels.hubChannels(accountId),
    queryFn: () => whatsappChannelsService.listHubChannels(accountId),
  });
  const [selectedHubChannelId, setSelectedHubChannelId] = useState<string>('');
  const [attaching, setAttaching] = useState(false);

  async function handleAttachExisting() {
    if (!selectedHubChannelId) {
      toast.error(t('whatsappChannels.attachSelectChannelFirst'));
      return;
    }
    const picked = (hubChannelsQuery.data ?? []).find((c) => c.id === selectedHubChannelId);
    setAttaching(true);
    try {
      await whatsappChannelsService.attachExisting(accountId, { hubChannelId: selectedHubChannelId, name: picked?.name });
      await queryClient.invalidateQueries({ queryKey: queryKeys.whatsappChannels.list(accountId) });
      toast.success(t('whatsappChannels.attachSuccess'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('whatsappChannels.attachError');
      toast.error(msg);
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Path A: Embedded Signup */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="wa-channel-name">{t('whatsappChannels.channelName')}</Label>
          <Input id="wa-channel-name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} maxLength={255} />
          <p className="text-muted-foreground text-xs">{t('whatsappChannels.channelNameHelp')}</p>
        </div>
        <Button size="lg" disabled={submitting} onClick={handleCreateNew}>
          {submitting ? t('common.loading') : t('whatsappChannels.hubButton')}
        </Button>
      </div>

      {/* Visual divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">{t('common.or')}</span>
        </div>
      </div>

      {/* Path B: Attach existing */}
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('whatsappChannels.attachTitle')}</p>
          <p className="text-muted-foreground text-xs">{t('whatsappChannels.attachHelp')}</p>
        </div>

        <Select value={selectedHubChannelId} onValueChange={setSelectedHubChannelId} disabled={hubChannelsQuery.isLoading || attaching}>
          <SelectTrigger>
            <SelectValue placeholder={hubChannelsQuery.isLoading ? t('common.loading') : t('whatsappChannels.attachSelectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {(hubChannelsQuery.data ?? []).map((c: HubChannelOption) => (
              <SelectItem key={c.id} value={c.id} disabled={c.alreadyAttached}>
                {formatChannelLabel(c)}
                {c.alreadyAttached ? ` — ${t('whatsappChannels.attachAlreadyConnected')}` : ''}
              </SelectItem>
            ))}
            {hubChannelsQuery.data && hubChannelsQuery.data.length === 0 && (
              <SelectItem value="__none__" disabled>
                {t('whatsappChannels.attachEmpty')}
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <Button size="lg" variant="outline" disabled={!selectedHubChannelId || attaching} onClick={handleAttachExisting}>
          {attaching ? t('common.loading') : t('whatsappChannels.attachButton')}
        </Button>
      </div>
    </div>
  );
}

function formatChannelLabel(c: HubChannelOption): string {
  const parts: string[] = [];
  if (c.wabaName) parts.push(c.wabaName);
  else if (c.name) parts.push(c.name);
  if (c.displayPhoneNumber) parts.push(c.displayPhoneNumber);
  if (parts.length === 0) parts.push(c.id.slice(0, 8));
  return parts.join(' · ');
}
