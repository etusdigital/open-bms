import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Bell, Smartphone, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import i18n from '@/lib/i18n';
import { useAppStore } from '@/stores/app-store';
import type { Contact } from '../types';

type ChannelStatus = 'deliverable' | 'unsubscribed' | 'bounced' | 'blocked' | 'inactive';

interface ChannelRow {
  key: string;
  label: string;
  icon: typeof Mail;
  visible: boolean;
  status: ChannelStatus;
  lastSent?: string;
  lastOpen?: string;
  lastClick?: string;
}

function getEmailStatus(contact: Contact): ChannelStatus {
  if (contact.isBlocked) return 'blocked';
  if (contact.isUnsubscribed) return 'unsubscribed';
  if (contact.hasBounced) return 'bounced';
  if (contact.isValid && contact.email) return 'deliverable';
  return 'inactive';
}

function getChannelRows(contact: Contact, t: (key: string) => string): ChannelRow[] {
  return (
    [
      {
        key: 'email',
        label: t('contacts.channelEmail'),
        icon: Mail,
        visible: !!contact.email,
        status: getEmailStatus(contact),
        lastSent: contact.lastSent,
        lastOpen: contact.lastOpen,
        lastClick: contact.lastClick,
      },
      {
        key: 'webPush',
        label: t('contacts.channelWebPush'),
        icon: Bell,
        visible: !!contact.hasWebPush,
        status: contact.hasWebPush ? 'deliverable' : 'inactive',
        lastSent: contact.webPushLastSent,
        lastOpen: contact.webPushLastOpen,
        lastClick: contact.webPushLastClick,
      },
      {
        key: 'mobilePush',
        label: t('contacts.channelMobilePush'),
        icon: Smartphone,
        visible: !!contact.hasMobilePush,
        status: contact.hasMobilePush ? 'deliverable' : 'inactive',
        lastSent: contact.mobPushLastSent,
        lastOpen: contact.mobPushLastOpen,
        lastClick: contact.mobPushLastClick,
      },
      {
        key: 'sms',
        label: t('contacts.channelSms'),
        icon: MessageSquare,
        visible: !!contact.phone,
        status: contact.hasPhone && contact.phone ? 'deliverable' : 'inactive',
        lastSent: contact.smsLastSent,
        lastOpen: undefined,
        lastClick: contact.smsLastClick,
      },
      {
        key: 'whatsapp',
        label: t('contacts.channelWhatsapp'),
        icon: MessageSquare,
        visible: !!contact.hasWhatsapp,
        status: contact.hasWhatsapp ? 'deliverable' : 'inactive',
        lastSent: contact.whatsappLastSent,
        lastOpen: contact.whatsappLastOpen,
        lastClick: contact.whatsappLastClick,
      },
    ] as ChannelRow[]
  ).filter((ch) => ch.visible);
}

const statusVariants: Record<ChannelStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  deliverable: 'default',
  unsubscribed: 'outline',
  bounced: 'destructive',
  blocked: 'outline',
  inactive: 'outline',
};

interface ContactChannelsCardProps {
  contact: Contact;
}

export const ContactChannelsCard = memo(function ContactChannelsCard({ contact }: ContactChannelsCardProps) {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const timezone = auth.status === 'authenticated' ? auth.timezone : undefined;
  const fmtOpts = useMemo(
    () => ({ timezone, locale: i18n.language || navigator.language }),
    [timezone],
  );
  const rows = getChannelRows(contact, t as never);

  const statusLabels: Record<ChannelStatus, string> = {
    deliverable: t('contacts.deliverable'),
    unsubscribed: t('contacts.statusUnsubscribed'),
    bounced: t('contacts.statusBounced'),
    blocked: t('contacts.statusBlocked'),
    inactive: t('contacts.notDeliverable'),
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('contacts.channelsInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">—</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('contacts.channelsInfo')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('contacts.channels')}</TableHead>
              <TableHead className="text-xs">{t('contacts.status')}</TableHead>
              <TableHead className="text-xs">{t('contacts.channelLastSent')}</TableHead>
              <TableHead className="text-xs">{t('contacts.channelLastOpen')}</TableHead>
              <TableHead className="text-xs">{t('contacts.channelLastClick')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((ch) => (
              <TableRow key={ch.key}>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <ch.icon className="text-muted-foreground h-3.5 w-3.5" />
                    {ch.label}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[ch.status]} className="text-[10px]">
                    {statusLabels[ch.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDateTime(ch.lastSent, fmtOpts)}</TableCell>
                <TableCell className="text-xs">{formatDateTime(ch.lastOpen, fmtOpts)}</TableCell>
                <TableCell className="text-xs">{formatDateTime(ch.lastClick, fmtOpts)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
