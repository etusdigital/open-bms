import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessage } from '@/features/messages/use-messages';
import type { TwoFAChannel } from '../types';

interface TwoFAMessagePreviewDialogProps {
  messageId: number;
  channel: TwoFAChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TwoFAMessagePreviewDialog({ messageId, channel, open, onOpenChange }: TwoFAMessagePreviewDialogProps) {
  const { t } = useTranslation();
  const messageQuery = useMessage(open ? messageId : 0);
  const message = messageQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{message?.title ?? t('twofaMessages.title')}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          {messageQuery.isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : message ? (
            channel === 'email' ? (
              <EmailPreview message={message} />
            ) : channel === 'whatsapp' ? (
              <WhatsAppPreview message={message} />
            ) : (
              <SmsPreview message={message} />
            )
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function EmailPreview({
  message,
}: {
  message: { subject?: string; fromName?: string; fromMail?: string; content?: string };
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="bg-muted space-y-1 rounded-lg p-3 text-sm">
        {message.subject && (
          <div className="flex gap-2">
            <span className="font-medium">{t('messages.subject')}:</span>
            <span>{message.subject}</span>
          </div>
        )}
        {(message.fromName || message.fromMail) && (
          <div className="flex gap-2 text-xs">
            <span className="font-medium">{t('messages.from' as never)}:</span>
            <span>
              {message.fromName} {message.fromMail && `<${message.fromMail}>`}
            </span>
          </div>
        )}
      </div>
      {message.content && (
        <iframe
          srcDoc={message.content}
          sandbox=""
          title="Email preview"
          className="w-full rounded-lg border"
          style={{ height: 400 }}
        />
      )}
    </div>
  );
}

function SmsPreview({ message }: { message: { content?: string; url?: string } }) {
  return (
    <div className="border-muted mx-auto max-w-sm overflow-hidden rounded-xl border-2">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="flex-1 text-sm font-semibold">SMS</span>
      </div>
      <div className="bg-muted/30 min-h-[200px] p-4">
        <div className="bg-background max-w-[75%] rounded-lg rounded-bl-none p-3 text-sm shadow-sm">
          <p>{message.content}</p>
          {message.url && (
            <a
              href={message.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary mt-1 block text-xs break-all underline"
            >
              {message.url}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreview({ message }: { message: { content?: string; footer?: string; callToActionText?: string } }) {
  return (
    <div className="border-muted mx-auto max-w-sm overflow-hidden rounded-xl border-2">
      <div className="bg-background flex items-center gap-3 border-b p-3">
        <div className="bg-muted h-8 w-8 rounded-full" />
        <div className="flex-1">
          <p className="text-sm font-semibold">WhatsApp</p>
          <p className="text-muted-foreground text-xs">online</p>
        </div>
      </div>
      <div className="bg-muted/30 space-y-1 p-4">
        <div className="bg-background max-w-[80%] space-y-2 rounded-lg rounded-tl-none p-3 shadow-sm">
          <p className="text-xs">{message.content}</p>
          {message.footer && <p className="text-muted-foreground text-xs">{message.footer}</p>}
        </div>
        {message.callToActionText && (
          <div className="bg-background max-w-[80%] rounded-lg p-2 text-center shadow-sm">
            <span className="text-sm" style={{ color: '#35b7f1' }}>
              {message.callToActionText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
