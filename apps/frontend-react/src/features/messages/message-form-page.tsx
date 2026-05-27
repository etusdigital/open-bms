import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { FormPage } from '@/components/form-page';
import { Button } from '@/components/ui/button';
import MessageForm from './message-form';
import { useMessage, useCreateMessage, useUpdateMessage, useDuplicateMessage, useLabelsAll } from './use-messages';
import { ANY_MESSAGE_TYPE_LABELS, baseMessageType, type MessageType, type AnyMessageType } from './types';
import type { MessageFormValues } from './message-schema';
import { s3Gateway } from '@/features/super-admin/integrations/s3-gateway';
import { useAppStore, selectIsSuperAdmin } from '@/stores/app-store';

interface MessageFormPageProps {
  messageId?: number;
  messageType: AnyMessageType;
  /** Override default redirect after save. Receives the created/updated message ID. */
  onSuccess?: (messageId: number) => void;
}

function getListRoute(messageType: AnyMessageType): string {
  if (messageType.startsWith('transactional-')) return '/messages/transactional';
  switch (messageType) {
    case 'email':
      return '/messages';
    case 'sms':
      return '/messages/sms';
    case 'web-push':
      return '/messages/web-push';
    case 'mobile-push':
      return '/messages/mobile-push';
    case 'whatsapp':
      return '/messages/whatsapp';
    default:
      return '/messages';
  }
}

export default function MessageFormPage({ messageId, messageType, onSuccess }: MessageFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = messageId !== undefined;

  const messageQuery = useMessage(isEditing ? messageId : 0);
  const createMutation = useCreateMessage();
  const updateMutation = useUpdateMessage(messageId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const duplicateMutation = useDuplicateMessage();
  const labelsQuery = useLabelsAll();
  const allLabels = labelsQuery.data ?? [];

  const listRoute = getListRoute(messageType);
  const pageTitle = ANY_MESSAGE_TYPE_LABELS[messageType];
  const formMessageType = baseMessageType(messageType);
  const isTransactional = messageType.startsWith('transactional-');
  const campaignInUse = isEditing && messageQuery.data?.campaignInUse;

  const isEmail = formMessageType === 'email';
  const s3Query = useQuery({
    queryKey: ['s3-configured-check'],
    queryFn: () => s3Gateway.isConfigured(),
    enabled: isEmail,
    staleTime: 60_000,
  });
  const s3Missing = isEmail && !s3Query.isLoading && !s3Query.isError && s3Query.data === false;
  const isSuperAdmin = useAppStore(selectIsSuperAdmin);

  const handleTypeChange = (type: MessageType) => {
    const base = isTransactional ? '/messages/transactional' : '/messages';
    const route = `${base}/${type}/create`;
    navigate({ to: route });
  };

  const handleSubmit = (data: MessageFormValues, labelIds: number[]) => {
    if (s3Missing) return;
    const labels = labelIds
      .map((id) => {
        const label = allLabels.find((l) => l.id === id);
        return label ? { id: label.id, name: label.name } : null;
      })
      .filter(Boolean);

    const payload = { ...data, type: messageType, labels };
    mutation.mutate(payload as any, {
      onSuccess: (result) => {
        if (onSuccess && result?.id) {
          onSuccess(result.id);
        } else {
          navigate({ to: listRoute });
        }
      },
    });
  };

  if (isEditing && messageQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('messages.edit')} backTo={listRoute} backLabel={pageTitle} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && messageQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('messages.edit')} backTo={listRoute} backLabel={pageTitle} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && messageQuery.data
      ? {
          title: messageQuery.data.title,
          description: messageQuery.data.description ?? '',
          ippool: messageQuery.data.ippool ?? '',
          fromName: messageQuery.data.fromName ?? '',
          fromMail: messageQuery.data.fromMail ?? '',
          replyTo: messageQuery.data.replyTo ?? '',
          subject: messageQuery.data.subject ?? '',
          previewText: messageQuery.data.previewText ?? '',
          priority: messageQuery.data.priority ?? 'high',
          content: messageQuery.data.content ?? '',
          content_json: messageQuery.data.content_json ?? '',
          url: messageQuery.data.url ?? '',
          whatsappType: messageQuery.data.whatsappType ?? '',
          templateCategory: messageQuery.data.templateCategory ?? 'MARKETING',
          callToActionText: messageQuery.data.callToActionText ?? '',
          callToActionUrl: messageQuery.data.callToActionUrl ?? '',
          image: messageQuery.data.image ?? '',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('messages.edit') : t('messages.createMessage')}
        backTo={listRoute}
        backLabel={pageTitle}
      />
      <FormPage.Content className="w-full">
        {s3Missing && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {t('messages.s3RequiredAlert')}{' '}
              {isSuperAdmin ? (
                <Link to="/super-admin/integrations" className="underline underline-offset-2">
                  {t('messages.s3RequiredAlertLink')}
                </Link>
              ) : (
                t('messages.s3RequiredAlertNoAccess')
              )}
            </span>
          </div>
        )}
        {campaignInUse && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('messages.campaignInUseAlert')}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => duplicateMutation.mutate(messageId!)}
              disabled={duplicateMutation.isPending}
            >
              {t('messages.copyMessage')}
            </Button>
          </div>
        )}
        <div className="relative">
          <MessageForm
            key={messageQuery.data?.id}
            messageType={formMessageType}
            messageId={messageId}
            messageStatus={isEditing ? messageQuery.data?.status : undefined}
            campaignInUse={!!campaignInUse}
            defaultValues={defaultValues}
            templateUrl={isEditing ? messageQuery.data?.templateUrl : undefined}
            defaultLabelIds={
              isEditing && messageQuery.data?.labels ? messageQuery.data.labels.map((l) => l.id) : undefined
            }
            onSubmit={handleSubmit}
            onTypeChange={!isEditing ? handleTypeChange : undefined}
            isPending={mutation.isPending}
          />
          {s3Missing && (
            <div className="absolute inset-0 cursor-not-allowed rounded-lg bg-background/70" />
          )}
        </div>
      </FormPage.Content>
    </FormPage.Root>
  );
}
