import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InboxPreviewProps {
  senderName: string;
  subject: string;
  previewText: string;
}

export function InboxPreview({ senderName, subject, previewText }: InboxPreviewProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');

  const displaySender = senderName || t('messages.senderName');
  const displaySubject = subject || t('messages.subject');
  const displayPreview = previewText || t('messages.previewText');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t('messages.inboxPreview')}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === 'desktop' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setMode('desktop')}
            aria-label={t('messages.previewDesktop')}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={mode === 'mobile' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => setMode('mobile')}
            aria-label={t('messages.previewMobile')}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'bg-background rounded-lg border transition-all',
          mode === 'mobile' ? 'mx-auto max-w-[320px]' : 'w-full',
        )}
      >
        {/* Gmail-like inbox header */}
        <div className="border-b px-3 py-2">
          <p className="text-muted-foreground text-xs">{t('messages.inboxPreviewHeader')}</p>
        </div>

        {/* Email row */}
        <div className="hover:bg-muted/50 flex items-start gap-3 px-3 py-3">
          {/* Checkbox placeholder */}
          <div className="border-muted-foreground/30 mt-0.5 h-4 w-4 shrink-0 rounded border" />

          {/* Star placeholder */}
          <div className="text-muted-foreground/30 mt-0.5 h-4 w-4 shrink-0">☆</div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className={cn('flex gap-2', mode === 'mobile' ? 'flex-col' : 'items-baseline')}>
              <span className="max-w-[140px] shrink-0 truncate text-sm font-semibold">{displaySender}</span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{displaySubject}</span>
                {displayPreview && (
                  <>
                    <span className="text-muted-foreground text-sm"> - </span>
                    <span className="text-muted-foreground truncate text-sm">{displayPreview}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Time */}
          <span className="text-muted-foreground shrink-0 text-xs">
            {new Date().getHours().toString().padStart(2, '0')}:{new Date().getMinutes().toString().padStart(2, '0')}
          </span>
        </div>

        {/* Placeholder rows */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t px-3 py-3 opacity-30">
            <div className="border-muted-foreground/30 h-4 w-4 shrink-0 rounded border" />
            <div className="text-muted-foreground/30 h-4 w-4 shrink-0">☆</div>
            <div className="flex-1 space-y-1">
              <div className="bg-muted-foreground/20 h-3 w-24 rounded" />
              <div className="bg-muted-foreground/10 h-3 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
