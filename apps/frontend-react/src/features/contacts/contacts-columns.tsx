import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2, Mail, Bell, Smartphone, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/stores/app-store';
import type { Contact } from './types';
import { formatDateTimeTz, getStatusInfo } from './contacts-utils';

export const selectColumn: ColumnDef<Contact, unknown> = {
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
};

function getLastInteractionDate(contact: Contact): string | undefined {
  return contact.lastOpen || contact.lastClick || undefined;
}

const channelDefs = [
  {
    label: 'Email',
    icon: Mail,
    isActive: (c: Contact) => !!c.email && !!c.isValid && !c.hasBounced && !c.isUnsubscribed && !c.isBlocked,
  },
  {
    label: 'Web Push',
    icon: Bell,
    isActive: (c: Contact) => !!c.hasWebPush,
  },
  {
    label: 'Mobile Push',
    icon: Smartphone,
    isActive: (c: Contact) => !!c.hasMobilePush,
  },
  {
    label: 'SMS',
    icon: MessageSquare,
    isActive: (c: Contact) => !!c.hasPhone && !!c.phone,
  },
  {
    label: 'WhatsApp',
    icon: MessageSquare,
    isActive: (c: Contact) => !!c.hasWhatsapp,
  },
];

const MAX_VISIBLE_TAGS = 2;

interface UseContactsColumnsOptions {
  onDelete: (contact: Contact) => void;
  canDelete: boolean;
}

export function useContactsColumns({ onDelete, canDelete }: UseContactsColumnsOptions): ColumnDef<Contact, unknown>[] {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const timezone = auth.status === 'authenticated' ? auth.timezone : undefined;
  const locale = i18n.language || navigator.language;

  const fmtOpts = useMemo(() => ({ timezone, locale }), [timezone, locale]);

  return useMemo(() => {
    const columns: ColumnDef<Contact, unknown>[] = [
      {
        accessorKey: 'firstName',
        header: t('contacts.name'),
        enableSorting: true,
        cell: ({ row }) => {
          const name = row.original.firstName || t('contacts.noName', 'Sem nome');
          return (
            <div className="max-w-[200px]">
              <Link
                to="/contacts/$contactUuid"
                params={{ contactUuid: row.original.uuid ?? String(row.original.id) }}
                className="text-primary font-medium hover:underline"
              >
                {name}
              </Link>
            </div>
          );
        },
      },
      {
        accessorKey: 'email',
        header: t('contacts.email'),
        enableSorting: true,
        cell: ({ row }) => <span className="text-sm">{row.original.email}</span>,
      },
      {
        id: 'status',
        header: t('contacts.status'),
        enableSorting: false,
        cell: ({ row }) => {
          const { label, variant } = getStatusInfo(row.original);
          return (
            <Badge variant={variant}>
              {t(`contacts.status${label.charAt(0).toUpperCase() + label.slice(1)}` as never) || label}
            </Badge>
          );
        },
      },
      {
        id: 'channels',
        header: t('contacts.channels'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {channelDefs.map((ch) => {
              const active = ch.isActive(row.original);
              return (
                <Tooltip key={ch.label}>
                  <TooltipTrigger asChild>
                    <ch.icon className={`h-3.5 w-3.5 ${active ? 'text-foreground' : 'text-muted-foreground/30'}`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {ch.label} — {active ? t('contacts.channelActive') : t('contacts.notDeliverable')}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('contacts.createdAt'),
        enableSorting: true,
        cell: ({ row }) => <span className="text-xs">{formatDateTimeTz(row.original.createdAt, fmtOpts)}</span>,
      },
      {
        id: 'lastInteraction',
        header: t('contacts.lastInteraction'),
        enableSorting: false,
        cell: ({ row }) => {
          const dateStr = getLastInteractionDate(row.original);
          return (
            <span className="text-muted-foreground text-xs">{dateStr ? formatDateTimeTz(dateStr, fmtOpts) : '—'}</span>
          );
        },
      },
      {
        id: 'tags',
        header: t('contacts.tagsColumn'),
        enableSorting: false,
        cell: ({ row }) => {
          const tags = row.original.contactTag ?? [];
          if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
          const visible = tags.slice(0, MAX_VISIBLE_TAGS);
          const remaining = tags.length - MAX_VISIBLE_TAGS;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map((tag) => (
                <Badge
                  key={typeof tag === 'string' ? tag : tag.id}
                  variant="outline"
                  className="px-1.5 py-0 text-[10px]"
                >
                  {typeof tag === 'string' ? tag : tag.name || tag.title}
                </Badge>
              ))}
              {remaining > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      +{remaining}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {tags.slice(MAX_VISIBLE_TAGS).map((tag) => (
                      <div key={typeof tag === 'string' ? tag : tag.id}>
                        {typeof tag === 'string' ? tag : tag.name || tag.title}
                      </div>
                    ))}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const editLabel = t('common.edit');
          const deleteLabel = t('common.deleteEntity', { entity: t('contacts.entityName') });

          return (
            <div className="flex justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" asChild>
                    <Link
                      to="/contacts/$contactUuid"
                      params={{ contactUuid: row.original.uuid ?? String(row.original.id) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">{editLabel}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{editLabel}</TooltipContent>
              </Tooltip>

              {canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(row.original)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">{deleteLabel}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{deleteLabel}</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ];

    return columns;
  }, [t, onDelete, canDelete, fmtOpts]);
}
