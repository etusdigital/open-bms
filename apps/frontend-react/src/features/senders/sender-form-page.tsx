import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { SenderForm } from './sender-form';
import { useSender, useUpdateSender } from './use-senders';
import type { SenderFormValues } from './sender-schema';

interface SenderFormPageProps {
  senderId: number;
}

export function SenderFormPage({ senderId }: SenderFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const senderQuery = useSender(senderId);
  const updateMutation = useUpdateSender(senderId);

  const handleSubmit = (data: SenderFormValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/senders', search: {} as never });
      },
    });
  };

  if (senderQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('senders.edit')} backTo="/senders" backLabel={t('senders.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (senderQuery.error || !senderQuery.data) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('senders.edit')} backTo="/senders" backLabel={t('senders.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const sender = senderQuery.data;
  const defaultValues: SenderFormValues = {
    senderReplyTo: sender.senderReplyTo ?? '',
    sendingLimit: sender.sendingLimit != null ? String(sender.sendingLimit) : '0',
  };

  return (
    <FormPage.Root>
      <FormPage.Header title={t('senders.edit')} backTo="/senders" backLabel={t('senders.pageTitle')} />
      <FormPage.Content>
        <SenderForm
          key={sender.id}
          senderName={sender.senderName}
          senderEmail={sender.senderEmail}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={updateMutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
