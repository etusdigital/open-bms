import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContact, useUpdateContact } from './use-contacts';
import { ContactEditDialog } from './contact-edit-dialog';
import type { ContactEditValues } from './contact-schema';
import { formatDate, getContactName, getStatusInfo } from './contacts-utils';
import { ContactTagsCard } from './components/contact-tags-card';
import { ContactCustomFieldsCard } from './components/contact-custom-fields-card';
import { ContactChannelsCard } from './components/contact-channels-card';
import { ContactHistoryCard } from './components/contact-history-card';
import { useAppStore } from '@/stores/app-store';

interface ContactDetailPageProps {
  contactUuid: string;
}

export function ContactDetailPage({ contactUuid }: ContactDetailPageProps) {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  const contactQuery = useContact(contactUuid);
  const updateMutation = useUpdateContact(contactUuid);

  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = useCallback(
    (data: ContactEditValues) => {
      updateMutation.mutate(data, {
        onSuccess: () => setEditOpen(false),
      });
    },
    [updateMutation],
  );

  if (contactQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (contactQuery.error || !contactQuery.data) {
    return (
      <div className="space-y-4 p-6">
        <Link
          to="/contacts"
          search={{} as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('contacts.pageTitle')}
        </Link>
        <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
      </div>
    );
  }

  const contact = contactQuery.data;
  const { label: statusLabel, variant: statusVariant } = getStatusInfo(contact);
  const tags = Array.isArray(contact.contactTag) ? contact.contactTag : [];
  const customFields = Array.isArray(contact.customFields) ? contact.customFields : [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/contacts"
            search={{} as never}
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('contacts.pageTitle')}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{getContactName(contact)}</h1>
            <Badge variant={statusVariant}>
              {t(`contacts.status${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}` as never) ||
                statusLabel}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">{contact.email}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t('contacts.details')}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t('common.edit')}
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.firstName')}</dt>
                  <dd className="col-span-2">{contact.firstName || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.lastName')}</dt>
                  <dd className="col-span-2">{contact.lastName || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.email')}</dt>
                  <dd className="col-span-2">{contact.email}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.phone')}</dt>
                  <dd className="col-span-2">{contact.phone || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.city')}</dt>
                  <dd className="col-span-2">{contact.city || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.region')}</dt>
                  <dd className="col-span-2">{contact.region || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.country')}</dt>
                  <dd className="col-span-2">{contact.country || '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <dt className="text-muted-foreground">{t('contacts.createdAt')}</dt>
                  <dd className="col-span-2">{formatDate(contact.createdAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Tags */}
          <ContactTagsCard contactId={contact.id} tags={tags} />

          {/* Channels */}
          <ContactChannelsCard contact={contact} />

          {/* Custom Fields */}
          <ContactCustomFieldsCard contactId={contact.id} accountId={accountId} customFields={customFields} />
        </div>

        {/* Right column - Activity History */}
        <ContactHistoryCard contactId={contact.id} />
      </div>

      {/* Edit Dialog */}
      {contactQuery.data && (
        <ContactEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={handleEdit}
          isPending={updateMutation.isPending}
          defaultValues={{
            firstName: contact.firstName ?? '',
            lastName: contact.lastName ?? '',
            email: contact.email,
            phone: contact.phone ?? '',
            city: contact.city ?? '',
            region: contact.region ?? '',
            country: contact.country ?? '',
            isActive: contact.isActive,
          }}
        />
      )}
    </div>
  );
}
