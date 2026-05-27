import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSendTestEmail, useSendTestMobilePush } from '../use-messages';
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
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TestSendSection({ messageType, getFormData }: TestSendSectionProps) {
  const { t } = useTranslation();
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const sendTestEmail = useSendTestEmail();
  const sendTestMobilePush = useSendTestMobilePush();

  const isMobilePush = messageType === 'mobile-push';
  const isPending = sendTestEmail.isPending || sendTestMobilePush.isPending;

  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    if (!isMobilePush && !recipientName.trim()) {
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

  const handleSend = () => {
    if (!validate()) return;

    const formData = getFormData();

    if (messageType === 'email') {
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
          content: formData.content,
          from: { firstName: formData.fromName, email: formData.fromMail },
        },
        loadContactFromDatabase: true,
      });
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
      {!isMobilePush && (
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

      <Button type="button" variant="outline" onClick={handleSend} disabled={isPending}>
        {isPending ? t('common.loading') : t('messages.sendTest')}
      </Button>
    </div>
  );
}
