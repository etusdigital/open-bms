import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSendTestEmail, useSendTestMobilePush, useSendTestWhatsApp } from '../use-messages';
import type { MessageType, MessagePriority } from '../types';

interface TestSendSectionProps {
  messageType: MessageType;
  getFormData: () => {
    id?: number;
    title: string;
    previewText: string;
    ippool: string;
    subject: string;
    replyTo: string;
    priority: MessagePriority;
    content: string;
    fromName: string;
    fromMail: string;
    url?: string;
    expiryPushInSeconds?: string;
  };
  /**
   * For email, resolves the live HTML straight from the editor. A new/unsaved
   * message has no `content` in form state yet (it's only generated on save),
   * so the test send pulls the current editor HTML instead. Falls back to
   * `getFormData().content` when absent.
   */
  getEmailContent?: () => Promise<string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TestSendSection({ messageType, getFormData, getEmailContent }: TestSendSectionProps) {
  const { t } = useTranslation();
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  // Covers the async editor HTML export that runs before the mutation fires.
  const [preparing, setPreparing] = useState(false);
  const sendTestEmail = useSendTestEmail();
  const sendTestMobilePush = useSendTestMobilePush();
  const sendTestWhatsApp = useSendTestWhatsApp();

  const isMobilePush = messageType === 'mobile-push';
  const isWhatsApp = messageType === 'whatsapp';
  const emailOnly = isMobilePush || isWhatsApp;
  const isPending = preparing || sendTestEmail.isPending || sendTestMobilePush.isPending || sendTestWhatsApp.isPending;

  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    if (!emailOnly && !recipientName.trim()) {
      newErrors.name = t('messages.testSendNameRequired');
    }
    if (!recipientEmail.trim()) {
      newErrors.email = t('messages.testSendEmailRequired');
    } else if (!EMAIL_REGEX.test(recipientEmail.trim())) {
      newErrors.email = t('messages.testSendEmailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSend = async () => {
    if (!validate()) return;

    const formData = getFormData();

    if (messageType === 'email') {
      // New/unsaved messages have no `content` yet — it's only generated on
      // save. Pull the live HTML from the editor so a test send works before
      // the first save (and reflects unsaved edits when editing).
      let content = formData.content;
      if (getEmailContent) {
        setPreparing(true);
        try {
          content = await getEmailContent();
        } finally {
          setPreparing(false);
        }
      }
      sendTestEmail.mutate({
        contact: { email: recipientEmail.trim(), firstName: recipientName.trim() },
        message: {
          id: formData.id ?? 0,
          title: formData.title,
          previewText: formData.previewText,
          ippool: formData.ippool,
          subject: formData.subject,
          replyTo: formData.replyTo,
          priority: formData.priority,
          content,
          from: { firstName: formData.fromName, email: formData.fromMail },
        },
        loadContactFromDatabase: true,
      });
    } else if (messageType === 'whatsapp') {
      sendTestWhatsApp.mutate({ email: recipientEmail.trim(), messageId: formData.id ?? 0 });
    } else if (messageType === 'mobile-push') {
      sendTestMobilePush.mutate({
        email: recipientEmail.trim(),
        message: {
          id: formData.id ?? 0,
          title: formData.title,
          subject: formData.subject,
          content: formData.content,
          url: formData.url ?? '',
          type: 'mobile-push',
          expiryPushInSeconds: formData.expiryPushInSeconds ?? '',
        },
      });
    }
  };

  return (
    <div className="space-y-4">
      {isWhatsApp && <p className="text-muted-foreground text-sm">{t('messages.testSendWhatsAppHint')}</p>}
      {!emailOnly && (
        <div className="space-y-1">
          <Label htmlFor="recipientName">{t('messages.recipientName')}</Label>
          <Input
            id="recipientName"
            value={recipientName}
            onChange={(e) => {
              setRecipientName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
          />
          {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="recipientEmail">{t('messages.recipientEmail')}</Label>
        <Input
          id="recipientEmail"
          type="email"
          value={recipientEmail}
          onChange={(e) => {
            setRecipientEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
      </div>

      <Button type="button" variant="outline" onClick={() => void handleSend()} disabled={isPending}>
        {isPending ? t('common.loading') : t('messages.sendTest')}
      </Button>
    </div>
  );
}
