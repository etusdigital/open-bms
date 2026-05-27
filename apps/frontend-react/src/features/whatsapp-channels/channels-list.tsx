import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { type WhatsappChannelStatus, useDeleteWhatsappChannel, useWhatsappChannels, type WhatsappChannelSummary } from './api';

interface Props {
  accountId: number;
}

const STATUS_VARIANTS: Record<WhatsappChannelStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending: 'secondary',
  disconnected: 'outline',
  error: 'destructive',
};

/**
 * Wave 7.4 — list of connected WhatsApp channels for the current account.
 *
 * Read uses the list query; status badge reflects the row state. EvoHub
 * channels in `pending` show a confirmation hint that signup is still in
 * progress; the row gets refreshed when react-query refetches.
 */
export function ChannelsList({ accountId }: Props) {
  const { t } = useTranslation();
  const { data: channels, isLoading } = useWhatsappChannels(accountId);
  const deleteChannel = useDeleteWhatsappChannel(accountId);
  const [pendingDelete, setPendingDelete] = useState<WhatsappChannelSummary | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteChannel.mutateAsync(pendingDelete.id);
      toast.success(t('whatsappChannels.deletedOk'));
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message ? String(err.response.data.message) : t('whatsappChannels.deleteError');
      toast.error(msg);
    } finally {
      setPendingDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return <p className="text-muted-foreground text-sm italic">{t('whatsappChannels.empty')}</p>;
  }

  return (
    <>
      <ul className="divide-border divide-y rounded-md border">
        {channels.map((channel) => (
          <li key={channel.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{channel.name}</span>
                <Badge variant={STATUS_VARIANTS[channel.status]}>{t(`whatsappChannels.status.${channel.status}`)}</Badge>
                <Badge variant="outline" className="text-xs">
                  {channel.mode === 'evohub' ? 'EvoHub' : 'Meta'}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 truncate text-xs">{channel.displayPhoneNumber ?? channel.phoneNumberId ?? t('whatsappChannels.noPhoneYet')}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label={t('whatsappChannels.deleteAria')} onClick={() => setPendingDelete(channel)} disabled={deleteChannel.isPending}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('whatsappChannels.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('whatsappChannels.deleteDescription', { name: pendingDelete?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
