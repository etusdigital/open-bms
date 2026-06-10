import { useState, useRef, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { EditorRef } from 'react-email-editor';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { messageSchemas, MESSAGE_TITLE_MAX, MESSAGE_DESCRIPTION_MAX, type MessageFormValues } from './message-schema';
import type { MessageType, MessageStatus } from './types';
import { validateMessageName, useSyncTemplateStatus } from './use-messages';
import { MessageTypeSelector } from './components/message-type-selector';
import { MessageStatusBadge } from './components/message-status-badge';
import { EmailContentForm } from './components/email-content-form';
import { SmsContentForm } from './components/sms-content-form';
import { WebPushContentForm } from './components/web-push-content-form';
import { MobilePushContentForm } from './components/mobile-push-content-form';
import { WhatsAppContentForm } from './components/whatsapp-content-form';
import { TestSendSection } from './components/test-send-section';
import { LabelMultiSelect } from './components/label-multi-select';

interface MessageFormProps {
  messageType: MessageType;
  messageId?: number;
  messageStatus?: MessageStatus;
  campaignInUse?: boolean;
  defaultValues?: Record<string, unknown>;
  defaultLabelIds?: number[];
  templateUrl?: string;
  onSubmit: (data: MessageFormValues, labelIds: number[]) => void;
  onTypeChange?: (type: MessageType) => void;
  isPending: boolean;
}

export default function MessageForm({
  messageType,
  messageId,
  messageStatus,
  campaignInUse,
  defaultValues,
  defaultLabelIds,
  templateUrl,
  onSubmit,
  onTypeChange,
  isPending,
}: MessageFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;
  const isWhatsApp = messageType === 'whatsapp';
  const isReadOnly = isEditing && (!!campaignInUse || (isWhatsApp && !!messageStatus && messageStatus !== 'draft'));
  const schema = messageSchemas[messageType];
  const syncTemplateStatus = useSyncTemplateStatus();
  const canSyncTemplateStatus = isWhatsApp && isEditing && messageId != null && (messageStatus === 'send_approval' || messageStatus === 'sent_approval' || messageStatus === 'approved' || messageStatus === 'rejected');
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>(defaultLabelIds ?? []);
  const [noLinkConfirmOpen, setNoLinkConfirmOpen] = useState(false);
  const pendingSubmitRef = useRef<MessageFormValues | null>(null);
  const statusRef = useRef<'draft' | 'send_approval'>('draft');
  const emailEditorRef = useRef<EditorRef>(null);

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: (defaultValues as MessageFormValues) ?? getDefaults(messageType),
  });

  const title = form.watch('title') ?? '';
  const titleLength = title.length;
  const [nameError, setNameError] = useState<string | null>(null);
  const initialTitle = useRef(defaultValues?.title as string | undefined);

  useEffect(() => {
    if (!title || title.length < 3) {
      setNameError(null);
      return;
    }
    // Skip check if title unchanged in edit mode
    if (isEditing && title === initialTitle.current) {
      setNameError(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const available = await validateMessageName(title, messageType, messageId);
        setNameError(available ? null : t('messages.nameAlreadyExists'));
      } catch {
        // Silently fail — don't block form for network errors
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, messageType, messageId, isEditing, t]);

  const showTestSend = messageType === 'email' || messageType === 'mobile-push';

  // Email body comes from one of two surfaces: the SuperAdmin "Custom HTML"
  // textarea (wins when edited) or the Unlayer editor. Reads the live editor,
  // not saved `content`, so it works for unsaved messages too. Shared by save
  // and test send.
  const resolveEmailContent = useCallback((): Promise<{ html: string; design?: object }> => {
    return new Promise((resolve) => {
      const values = form.getValues();
      const customHtml = (('content' in values ? values.content : '') as string) ?? '';
      // The `content` field only goes dirty when someone edits the Custom HTML
      // textarea — the visual editor is a separate iframe and never touches it.
      const customHtmlEdited = form.getFieldState('content').isDirty;
      if (customHtmlEdited && customHtml.trim()) {
        resolve({ html: customHtml });
        return;
      }
      const editor = emailEditorRef.current?.editor;
      if (editor) {
        editor.exportHtml((data: { design: object; html: string }) => {
          resolve({ html: data.html ?? '', design: data.design });
        });
        return;
      }
      resolve({ html: customHtml });
    });
  }, [form]);

  const submitFormData = useCallback(
    (formData: MessageFormValues) => {
      if (messageType === 'email') {
        void resolveEmailContent().then(({ html, design }) => {
          onSubmit(
            {
              ...formData,
              content: html,
              // Keep the existing design JSON when the body came from custom
              // HTML (no design); otherwise persist the editor's design.
              content_json: design
                ? JSON.stringify(design)
                : ('content_json' in formData ? (formData.content_json as string) : '') ?? '',
            } as MessageFormValues,
            selectedLabelIds,
          );
        });
        return;
      }
      const dataWithStatus = messageType === 'whatsapp' ? { ...formData, status: statusRef.current } : formData;
      onSubmit(dataWithStatus as MessageFormValues, selectedLabelIds);
      statusRef.current = 'draft';
    },
    [messageType, onSubmit, selectedLabelIds, resolveEmailContent],
  );

  const handleFormSubmit = useCallback(
    (formData: MessageFormValues) => {
      if (messageType === 'sms') {
        const content = 'content' in formData ? (formData.content as string) : '';
        const hasUrl = /https?:\/\/[\w.-]+(?:\.[\w.-]+)+(?:\/\S*)?/i.test(content);
        if (!hasUrl) {
          pendingSubmitRef.current = formData;
          setNoLinkConfirmOpen(true);
          return;
        }
      }
      submitFormData(formData);
    },
    [messageType, submitFormData],
  );

  const handleNoLinkConfirm = useCallback(() => {
    setNoLinkConfirmOpen(false);
    if (pendingSubmitRef.current) {
      submitFormData(pendingSubmitRef.current);
      pendingSubmitRef.current = null;
    }
  }, [submitFormData]);

  const getFormData = () => {
    const values = form.getValues();

    // Calculate expiry in seconds for mobile push
    let expiryPushInSeconds = '';
    if ('expiryPushEnabled' in values && values.expiryPushEnabled) {
      const val = Number(('expiryPushValue' in values ? values.expiryPushValue : 0) ?? 0);
      const filter = ('expiryPushFilter' in values ? values.expiryPushFilter : 'day') ?? 'day';
      const seconds = filter === 'day' ? val * 86400 : val * 3600;
      expiryPushInSeconds = seconds > 0 ? String(seconds) : '';
    }

    return {
      id: messageId,
      title: values.title,
      previewText: ('previewText' in values ? values.previewText : '') ?? '',
      ippool: ('ippool' in values ? values.ippool : '') ?? '',
      subject: ('subject' in values ? values.subject : '') ?? '',
      replyTo: ('replyTo' in values ? values.replyTo : '') ?? '',
      priority: ('priority' in values ? values.priority : 'high') as 'low' | 'normal' | 'high',
      content: ('content' in values ? values.content : '') ?? '',
      fromName: ('fromName' in values ? values.fromName : '') ?? '',
      fromMail: ('fromMail' in values ? values.fromMail : '') ?? '',
      url: ('url' in values ? values.url : '') ?? '',
      expiryPushInSeconds,
    };
  };

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <ConfirmDialog
        open={noLinkConfirmOpen}
        onOpenChange={setNoLinkConfirmOpen}
        title={t('messages.smsNoLinkTitle')}
        description={t('messages.smsNoLinkDescription')}
        onConfirm={handleNoLinkConfirm}
        variant="default"
        autoFocusAction
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* WhatsApp approval status alert */}
          {messageType === 'whatsapp' && isEditing && messageStatus && (
            <div
              role="alert"
              className={cn(
                'flex items-center gap-2 rounded-md border p-3 text-sm',
                messageStatus === 'draft' &&
                  'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200',
                (messageStatus === 'send_approval' || messageStatus === 'sent_approval') &&
                  'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200',
                messageStatus === 'approved' &&
                  'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200',
                messageStatus === 'rejected' &&
                  'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200',
              )}
            >
              {messageStatus === 'draft' && <AlertTriangle className="h-4 w-4 shrink-0" />}
              {(messageStatus === 'send_approval' || messageStatus === 'sent_approval') && (
                <Info className="h-4 w-4 shrink-0" />
              )}
              {messageStatus === 'approved' && <CheckCircle className="h-4 w-4 shrink-0" />}
              {messageStatus === 'rejected' && <XCircle className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{t(`messages.whatsappAlert_${messageStatus}`)}</span>
              {canSyncTemplateStatus && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => messageId != null && syncTemplateStatus.mutate(messageId)}
                  disabled={syncTemplateStatus.isPending}
                  className="shrink-0"
                >
                  <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', syncTemplateStatus.isPending && 'animate-spin')} />
                  {syncTemplateStatus.isPending ? t('common.loading') : t('messages.syncStatusButton')}
                </Button>
              )}
            </div>
          )}

          {/* Non-WhatsApp status badge + read-only alert */}
          {messageType !== 'whatsapp' && messageStatus && isEditing && (
            <div className="flex items-center gap-3">
              <MessageStatusBadge status={messageStatus} />
              {isReadOnly && <p className="text-muted-foreground text-sm">{t('messages.readOnlyStatus')}</p>}
            </div>
          )}

          <fieldset disabled={isReadOnly} className="space-y-6">
            {/* Block 1: Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t('messages.details')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t('messages.title')}</FormLabel>
                        <span className="text-muted-foreground text-xs">
                          {t('validation.charCount', {
                            count: titleLength,
                            max: MESSAGE_TITLE_MAX,
                          })}
                        </span>
                      </div>
                      <FormControl>
                        <Input {...field} maxLength={MESSAGE_TITLE_MAX} />
                      </FormControl>
                      <FormMessage />
                      {nameError && <p className="text-destructive text-sm">{nameError}</p>}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('messages.description')}</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} maxLength={MESSAGE_DESCRIPTION_MAX} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('labels.entityName')}</label>
                  <LabelMultiSelect selectedIds={selectedLabelIds} onChange={setSelectedLabelIds} />
                </div>
              </CardContent>
            </Card>

            {/* Block 2: Message Type Selector */}
            <Card>
              <CardHeader>
                <CardTitle>{t('messages.messageType')}</CardTitle>
              </CardHeader>
              <CardContent>
                <MessageTypeSelector
                  value={messageType}
                  onChange={(type) => onTypeChange?.(type)}
                  disabled={isEditing}
                />
              </CardContent>
            </Card>

            {/* Block 3: Content. Email is rendered below, outside this fieldset. */}
            {messageType !== 'email' && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('messages.content')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {messageType === 'sms' && <SmsContentForm />}
                  {messageType === 'web-push' && <WebPushContentForm />}
                  {messageType === 'mobile-push' && <MobilePushContentForm />}
                  {messageType === 'whatsapp' && <WhatsAppContentForm />}
                </CardContent>
              </Card>
            )}

            {/* Server error */}
            {form.formState.errors.root?.serverError && (
              <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {form.formState.errors.root.serverError.message}
              </div>
            )}
          </fieldset>

          {/* Outside the fieldset so export/copy/view stay clickable when in use;
              EmailContentForm locks its own editing controls via isReadOnly. */}
          {messageType === 'email' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('messages.content')}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailContentForm
                  editorRef={emailEditorRef}
                  designJson={isEditing ? (defaultValues?.content_json as string) : undefined}
                  templateUrl={templateUrl}
                  isReadOnly={isReadOnly}
                />
              </CardContent>
            </Card>
          )}

          {/* Block 4: Test Send — outside the fieldset so it works while in use. */}
          {showTestSend && (
            <Card>
              <CardHeader>
                <CardTitle>{t('messages.testSend')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TestSendSection
                  messageType={messageType}
                  getFormData={getFormData}
                  getEmailContent={
                    // The editor iframe isn't disabled by the read-only fieldset,
                    // so skip the live (editable) HTML when read-only and let the
                    // test send fall back to the saved `content`.
                    messageType === 'email' && !isReadOnly
                      ? () => resolveEmailContent().then((r) => r.html)
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={isPending || isReadOnly}>
              {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
            </Button>
            {messageType === 'whatsapp' && (
              <Button
                type="button"
                disabled={isPending || isReadOnly}
                onClick={() => {
                  statusRef.current = 'send_approval';
                  form.handleSubmit(handleFormSubmit)();
                }}
              >
                {isPending
                  ? t('common.loading')
                  : isEditing
                    ? t('messages.sendApproval')
                    : t('messages.createAndSendApproval')}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </>
  );
}

function getDefaults(messageType: MessageType): Record<string, unknown> {
  const base = { title: '', description: '' };
  switch (messageType) {
    case 'sms':
      return { ...base, content: '' };
    case 'web-push':
      return {
        ...base,
        subject: '',
        content: '',
        url: '',
        image: '',
        expiryPushEnabled: false,
        expiryPushFilter: 'day',
      };
    case 'mobile-push':
      return {
        ...base,
        subject: '',
        content: '',
        url: '',
        image: '',
        notificationSound: 'default',
        expiryPushEnabled: false,
        expiryPushFilter: 'day',
      };
    case 'email':
      return {
        ...base,
        ippool: '',
        fromName: '',
        fromMail: '',
        replyTo: '',
        subject: '',
        previewText: '',
        priority: 'high',
        content: '',
        content_json: '',
      };
    case 'whatsapp':
      return {
        ...base,
        content: '',
        footer: '',
        headerType: 'none',
        headerContent: '',
        whatsappType: 'text',
        callToActionText: '',
        callToActionUrl: '',
      };
  }
}
